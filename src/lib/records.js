import { supabase } from './supabase';
import { storeGetAll, storeGet, storePut, storePutAndQueue, storeDelete, clearOperation, getFile } from './offlineStore';

const now = () => new Date().toISOString();
const makeId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;
const notifyChange = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('ali-hub-data-change')); };

function localRow(row) {
  return { ...row, _local: true, _sync_status: 'pending' };
}

function getStoragePath(row) {
  if (row?.section === 'documents') return row.payload?.storage_path || null;
  if (row?.section === 'assignments') return row.payload?.attachment?.storage_path || null;
  return null;
}

async function uploadRecordFile(row) {
  let fileId = null;
  let fileName = row.title;
  let currentPath = null;

  if (row.section === 'documents') {
    fileId = row.payload?.local_file_id;
    fileName = row.payload?.name || row.title;
    currentPath = row.payload?.storage_path;
  } else if (row.section === 'assignments') {
    fileId = row.payload?.attachment?.local_file_id;
    fileName = row.payload?.attachment?.name || row.title;
    currentPath = row.payload?.attachment?.storage_path;
  }

  if (!fileId || currentPath) return row;

  const localFile = await getFile(fileId);
  if (!localFile?.file) throw new Error(`Local attachment is missing: ${fileName}`);

  const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${row.user_id}/${fileId}-${safe}`;

  const { error } = await supabase.storage
    .from('ali-hub-documents')
    .upload(path, localFile.file, { upsert: true });

  if (error) throw error;

  if (row.section === 'documents') {
    return { ...row, payload: { ...row.payload, storage_path: path } };
  }

  return {
    ...row,
    payload: {
      ...row.payload,
      attachment: { ...row.payload.attachment, storage_path: path }
    }
  };
}

export async function listRecords(userId, section) {
  const all = await storeGetAll('records');
  const local = all
    .filter(row => row.user_id === userId && row.section === section && !row._deleted)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  if (supabase && isOnline() && userId && !String(userId).startsWith('local-')) {
    try {
      await syncPending(userId);
      const { data, error } = await supabase.from('records')
        .select('*')
        .eq('user_id', userId)
        .eq('section', section)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const current = await storeGetAll('records');
        const sectionRows = current.filter(x => x.user_id === userId && x.section === section);
        const dirtyIds = new Set(current.filter(x => x.user_id === userId && x._sync_status === 'pending').map(x => x.id));
        const remoteIds = new Set(data.map(row => row.id));

        for (const row of sectionRows) {
          if (!dirtyIds.has(row.id) && !remoteIds.has(row.id)) await storeDelete('records', row.id);
        }

        for (const row of data) {
          if (!dirtyIds.has(row.id)) {
            await storePut('records', { ...row, _local: false, _sync_status: 'synced' });
          }
        }

        const refreshed = await storeGetAll('records');
        return refreshed
          .filter(row => row.user_id === userId && row.section === section && !row._deleted)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      }
    } catch (error) {
      console.warn('ALI HUB is continuing with its local copy:', error);
    }
  }

  return local;
}

export async function createRecord(userId, section, title, payload = {}) {
  const stamp = now();
  const row = localRow({
    id: makeId(),
    user_id: userId,
    section,
    title,
    payload,
    created_at: stamp,
    updated_at: stamp
  });

  await storePutAndQueue('records', row, { type: 'upsert', user_id: userId, row });

  if (supabase && isOnline() && !String(userId).startsWith('local-')) {
    try {
      await syncPending(userId);
    } catch (error) {
      console.warn('Saved locally; cloud sync will retry:', error);
    }
  }

  notifyChange();
  return row;
}

export async function updateRecord(id, changes) {
  const old = await storeGet('records', id);
  if (!old) throw new Error('This item is not available in the local workspace. Refresh and try again.');

  const row = localRow({ ...old, ...changes, updated_at: now() });
  await storePutAndQueue('records', row, { type: 'upsert', user_id: row.user_id, row });

  if (supabase && isOnline() && !String(row.user_id).startsWith('local-')) {
    try {
      await syncPending(row.user_id);
    } catch (error) {
      console.warn('Updated locally; cloud sync will retry:', error);
    }
  }

  notifyChange();
  return row;
}

export async function deleteRecord(id) {
  const old = await storeGet('records', id);
  if (!old) return;

  const tombstone = { ...old, _deleted: true, _sync_status: 'pending', updated_at: now() };

  await storePutAndQueue('records', tombstone, {
    type: 'delete',
    id,
    user_id: old.user_id,
    storage_path: getStoragePath(old)
  });

  if (supabase && isOnline() && !String(old.user_id).startsWith('local-')) {
    try {
      await syncPending(old.user_id);
    } catch (error) {
      console.warn('Deleted locally; cloud sync will retry:', error);
    }
  }

  notifyChange();
}

let syncLock = false;

export async function syncPending(userId) {
  if (syncLock || !supabase || !isOnline() || !userId || String(userId).startsWith('local-')) {
    return { synced: 0 };
  }

  syncLock = true;
  let synced = 0;

  try {
    const queue = (await storeGetAll('outbox'))
      .filter(op => op.user_id === userId)
      .sort((a, b) => a.opId - b.opId);

    for (const op of queue) {
      if (op.type === 'upsert') {
        let row = op.row;

        try {
          row = await uploadRecordFile(row);
        } catch (uploadError) {
          console.warn('File upload is waiting for a valid local file or connection:', uploadError);
          break;
        }

        if (getStoragePath(row) !== getStoragePath(op.row)) {
          await storePut('records', { ...row, _local: true, _sync_status: 'pending' });
        }

        const { error } = await supabase.from('records').upsert({
          id: row.id,
          user_id: row.user_id,
          section: row.section,
          title: row.title,
          payload: row.payload,
          created_at: row.created_at,
          updated_at: row.updated_at
        }, { onConflict: 'id' });

        if (error) break;

        const latest = await storeGet('records', row.id);

        if (latest && latest.updated_at === row.updated_at && !latest._deleted) {
          await storePut('records', { ...latest, _local: false, _sync_status: 'synced' });
        } else if (latest?._deleted) {
          const updatedPayload = row.section === 'documents'
            ? { ...latest.payload, storage_path: row.payload?.storage_path || latest.payload?.storage_path }
            : row.section === 'assignments'
              ? {
                  ...latest.payload,
                  attachment: {
                    ...latest.payload?.attachment,
                    storage_path: row.payload?.attachment?.storage_path || latest.payload?.attachment?.storage_path
                  }
                }
              : latest.payload;

          await storePut('records', { ...latest, payload: updatedPayload });
        }
      } else if (op.type === 'delete') {
        const latestLocal = await storeGet('records', op.id);
        const storagePath = op.storage_path || getStoragePath(latestLocal);

        if (storagePath) {
          const { error: storageError } = await supabase.storage
            .from('ali-hub-documents')
            .remove([storagePath]);

          if (storageError && !String(storageError.message || '').toLowerCase().includes('not found')) {
            break;
          }
        }

        const { error } = await supabase.from('records')
          .delete()
          .eq('id', op.id)
          .eq('user_id', userId);

        if (error) break;

        await storeDelete('records', op.id);
      }

      await clearOperation(op.opId);
      synced++;
    }
  } finally {
    syncLock = false;
  }

  return { synced };
}

export async function migrateLocalData(userId) {
  const marker = `ali-hub-migrated-${userId}`;

  try {
    if (localStorage.getItem(marker)) return { migrated: 0 };
  } catch {
    // IndexedDB remains the primary store.
  }

  let old = {};
  try {
    old = JSON.parse(localStorage.getItem('ali-hub-data') || '{}');
  } catch {
    old = {};
  }

  const mapping = {
    books: 'books',
    knowledge: 'knowledge',
    quizzes: 'quizzes',
    assignments: 'assignments',
    websites: 'websites',
    repositories: 'repositories',
    documents: 'documents',
    projects: 'projects',
    tasks: 'tasks',
    events: 'events'
  };

  let migrated = 0;

  const priorLocalRows = (await storeGetAll('records'))
    .filter(row => row.user_id === 'local-user' && !row._deleted);

  if (String(userId).startsWith('local-') && priorLocalRows.length) {
    try {
      localStorage.setItem(marker, now());
    } catch {
      // IndexedDB remains authoritative.
    }
    return { migrated: 0 };
  }

  for (const prior of priorLocalRows) {
    const row = localRow({
      ...prior,
      id: makeId(),
      user_id: userId,
      created_at: prior.created_at || now(),
      updated_at: now()
    });

    await storePutAndQueue('records', row, { type: 'upsert', user_id: userId, row });
    migrated++;
  }

  for (const [oldKey, section] of Object.entries(mapping)) {
    if (priorLocalRows.length) break;

    for (const item of (Array.isArray(old[oldKey]) ? old[oldKey] : [])) {
      const row = localRow({
        id: makeId(),
        user_id: userId,
        section,
        title: item.title || item.name || 'Imported item',
        payload: item,
        created_at: item.created_at || now(),
        updated_at: now()
      });

      await storePutAndQueue('records', row, { type: 'upsert', user_id: userId, row });
      migrated++;
    }
  }

  try {
    localStorage.setItem(marker, now());
  } catch {
    // IndexedDB remains authoritative.
  }

  if (supabase && isOnline() && !String(userId).startsWith('local-')) {
    try {
      await syncPending(userId);
    } catch (error) {
      console.warn('Saved locally; cloud sync will retry:', error);
    }
  }

  return { migrated };
}

export async function getCounts(userId) {
  const rows = (await storeGetAll('records'))
    .filter(row => row.user_id === userId && !row._deleted);

  const counts = {};
  for (const row of rows) {
    counts[row.section] = (counts[row.section] || 0) + 1;
  }

  return counts;
}
