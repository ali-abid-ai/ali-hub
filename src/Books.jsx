import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, BookOpen, LoaderCircle, Video, Upload, X } from 'lucide-react';
import { createRecord, deleteRecord, listRecords, updateRecord } from './lib/records';
import { saveFile, getFile, deleteFile, formatBytes } from './lib/offlineStore';

function BookVideo({ fileId, name }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let active = true;

    async function load() {
      try {
        const entry = await getFile(fileId);
        if (!entry?.file) throw new Error('Video file not found on this device.');
        objectUrl = URL.createObjectURL(entry.file);
        if (active) setUrl(objectUrl);
      } catch (e) {
        if (active) setError(e.message);
      }
    }

    load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (error) return <p className="error">{error}</p>;
  if (!url) return <p className="muted small">Loading video...</p>;

  return (
    <div className="book-video">
      <p><Video size={16} /> {name || 'Book video'}</p>
      <video controls preload="metadata" src={url} style={{ width: '100%', maxHeight: '320px', borderRadius: '12px' }}>
        Your browser does not support video playback.
      </video>
    </div>
  );
}

export default function Books({ user }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Reading');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  async function refresh() {
    setBusy(true);
    try {
      setItems(await listRecords(user.id, 'books'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [user.id]);

  const filtered = useMemo(
    () => items.filter(x =>
      `${x.title} ${x.payload?.author || ''} ${x.payload?.notes || ''} ${x.payload?.video_name || ''}`
        .toLowerCase().includes(search.toLowerCase())
    ),
    [items, search]
  );

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError('');

    let newVideoId = null;

    try {
      const oldItem = editing ? items.find(x => x.id === editing) : null;
      let videoData = {
        video_file_id: oldItem?.payload?.video_file_id || null,
        video_name: oldItem?.payload?.video_name || '',
        video_type: oldItem?.payload?.video_type || '',
        video_size: oldItem?.payload?.video_size || 0
      };

      if (selectedVideo) {
        newVideoId = crypto.randomUUID();

        await saveFile(newVideoId, selectedVideo, {
          name: selectedVideo.name,
          type: selectedVideo.type,
          size: selectedVideo.size,
          category: 'book-video'
        });

        videoData = {
          video_file_id: newVideoId,
          video_name: selectedVideo.name,
          video_type: selectedVideo.type,
          video_size: selectedVideo.size
        };
      }

      const payload = {
        ...(oldItem?.payload || {}),
        author,
        notes,
        status,
        progress: oldItem?.payload?.progress || 0,
        ...videoData
      };

      if (editing) {
        const row = await updateRecord(editing, {
          title: title.trim(),
          payload
        });

        setItems(items.map(x => x.id === editing ? row : x));

        if (selectedVideo && oldItem?.payload?.video_file_id) {
          await deleteFile(oldItem.payload.video_file_id).catch(() => {});
        }
      } else {
        const row = await createRecord(user.id, 'books', title.trim(), payload);
        setItems([row, ...items]);
      }

      setEditing(null);
      setTitle('');
      setAuthor('');
      setNotes('');
      setStatus('Reading');
      setSelectedVideo(null);

      const input = document.getElementById('book-video-input');
      if (input) input.value = '';

    } catch (e) {
      if (newVideoId) await deleteFile(newVideoId).catch(() => {});
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item) {
    setEditing(item.id);
    setTitle(item.title);
    setAuthor(item.payload?.author || '');
    setNotes(item.payload?.notes || '');
    setStatus(item.payload?.status || 'Reading');
    setSelectedVideo(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(null);
    setTitle('');
    setAuthor('');
    setNotes('');
    setStatus('Reading');
    setSelectedVideo(null);

    const input = document.getElementById('book-video-input');
    if (input) input.value = '';
  }

  async function remove(id) {
    if (!confirm('Delete this book and its attached video?')) return;

    try {
      const item = items.find(x => x.id === id);
      await deleteRecord(id);

      if (item?.payload?.video_file_id) {
        await deleteFile(item.payload.video_file_id).catch(() => {});
      }

      setItems(items.filter(x => x.id !== id));

      if (editing === id) cancelEdit();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeVideo(item) {
    if (!confirm('Remove the video attached to this book?')) return;

    try {
      const payload = { ...item.payload };
      const fileId = payload.video_file_id;

      delete payload.video_file_id;
      delete payload.video_name;
      delete payload.video_type;
      delete payload.video_size;

      const row = await updateRecord(item.id, {
        title: item.title,
        payload
      });

      setItems(items.map(x => x.id === item.id ? row : x));

      if (fileId) await deleteFile(fileId).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  }

  function chooseVideo(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file.');
      e.target.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('Video is too large. Maximum allowed size is 50 MB.');
      e.target.value = '';
      return;
    }

    setError('');
    setSelectedVideo(file);
  }

  return (
    <div className="module">
      <div className="module-head">
        <div>
          <h2>My Books</h2>
          <p>Organize your reading list, authors, study notes and book videos.</p>
        </div>
        <span className="count-pill">{items.length} books</span>
      </div>

      <form className="form-card" onSubmit={add}>
        <label>
          Book title
          <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Enter book title" />
        </label>

        <label>
          Author
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author name" />
        </label>

        <label>
          Reading status
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option>Want to read</option>
            <option>Reading</option>
            <option>Completed</option>
            <option>On hold</option>
          </select>
        </label>

        <label>
          Notes
          <textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add study notes or key ideas..." />
        </label>

        <label>
          <span><Video size={16} /> Attach book video (maximum 50 MB)</span>
          <input
            id="book-video-input"
            type="file"
            accept="video/*"
            onChange={chooseVideo}
          />
        </label>

        {selectedVideo && (
          <div className="notice">
            Selected: {selectedVideo.name} ({formatBytes(selectedVideo.size)})
            <button type="button" className="icon" onClick={() => {
              setSelectedVideo(null);
              const input = document.getElementById('book-video-input');
              if (input) input.value = '';
            }}>
              <X size={16} />
            </button>
          </div>
        )}

        <div className="form-actions">
          <button className="primary" disabled={saving}>
            {saving ? <LoaderCircle className="spin" /> : <Plus size={17} />}
            {saving ? 'Saving...' : editing ? 'Update book' : 'Add book'}
          </button>

          {editing && (
            <button type="button" className="secondary" onClick={cancelEdit}>
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search books and notes..." />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {busy ? (
        <p className="muted">Loading books...</p>
      ) : (
        <div className="record-grid">
          {filtered.map(item => (
            <article className="record-card" key={item.id}>
              <div className="record-title">
                <h3><BookOpen size={17} /> {item.title}</h3>

                <div className="record-actions">
                  <button className="secondary small-button" onClick={() => startEdit(item)}>Edit</button>
                  <button className="icon danger" onClick={() => remove(item.id)}><Trash2 size={17} /></button>
                </div>
              </div>

              {item.payload?.author && <p><b>Author:</b> {item.payload.author}</p>}

              <span className="status-pill">{item.payload?.status || 'Reading'}</span>

              {item.payload?.notes && <p className="preserve">{item.payload.notes}</p>}

              {item.payload?.video_file_id && (
                <div>
                  <BookVideo fileId={item.payload.video_file_id} name={item.payload.video_name} />
                  {item.payload?.video_size > 0 && (
                    <p className="muted small">{formatBytes(item.payload.video_size)}</p>
                  )}
                  <button type="button" className="secondary small-button" onClick={() => removeVideo(item)}>
                    <Trash2 size={15} /> Remove video
                  </button>
                </div>
              )}
            </article>
          ))}

          {!filtered.length && <div className="empty">No books found. Add your first book above.</div>}
        </div>
      )}
    </div>
  );
}
