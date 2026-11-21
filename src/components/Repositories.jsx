import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, ExternalLink, LoaderCircle, Github, Star, RefreshCw } from 'lucide-react';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/records';
import { supabase } from '../lib/supabase';

const initial = {
  url: '',
  description: '',
  technology: '',
  status: 'Active',
  is_starred: false
};

export default function Repositories({ user }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [values, setValues] = useState(initial);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setItems(await listRecords(user.id, 'repositories'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [user.id]);

  function change(key, value) {
    setValues(old => ({ ...old, [key]: value }));
  }

  function cancelEdit() {
    setEditing(null);
    setTitle('');
    setValues(initial);
  }

  function edit(item) {
    const p = item.payload || {};
    setEditing(item.id);
    setTitle(item.title || '');
    setValues({
      ...initial,
      ...p,
      url: p.github_url || p.url || '',
      technology: p.language || p.technology || '',
      is_starred: Boolean(p.is_starred)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        ...values,
        url: values.url.trim(),
        github_url: values.url.trim(),
        description: values.description.trim(),
        technology: values.technology.trim(),
        language: values.technology.trim()
      };

      if (editing) {
        const row = await updateRecord(editing, {
          title: title.trim(),
          payload
        });
        setItems(old => old.map(x => x.id === editing ? row : x));
      } else {
        const row = await createRecord(user.id, 'repositories', title.trim(), payload);
        setItems(old => [row, ...old]);
      }

      cancelEdit();
      setNotice('Repository saved successfully.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function importFromGitHub() {
    setImporting(true);
    setError('');
    setNotice('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('github-repositories');

      if (functionError) throw functionError;
      if (!data?.repositories) {
        throw new Error(data?.error || 'GitHub did not return repositories.');
      }

      const current = await listRecords(user.id, 'repositories');
      const existing = new Set(
        current.map(item =>
          (item.payload?.github_url || item.payload?.url || '').toLowerCase().replace(/\/$/, '')
        ).filter(Boolean)
      );

      let added = 0;
      let skipped = 0;

      for (const repo of data.repositories) {
        const url = (repo.html_url || '').toLowerCase().replace(/\/$/, '');

        if (!url || existing.has(url)) {
          skipped++;
          continue;
        }

        const payload = {
          url: repo.html_url,
          github_url: repo.html_url,
          description: repo.description || '',
          technology: repo.language || '',
          language: repo.language || '',
          stars: repo.stars || 0,
          visibility: repo.visibility || 'public',
          private: Boolean(repo.private),
          default_branch: repo.default_branch || 'main',
          archived: Boolean(repo.archived),
          status: repo.archived ? 'Archived' : 'Active',
          is_starred: false,
          source: 'github',
          updated_at: repo.updated_at || ''
        };

        const row = await createRecord(user.id, 'repositories', repo.name, payload);
        current.unshift(row);
        existing.add(url);
        added++;
      }

      setItems(current);
      setNotice(`GitHub import complete: ${added} added, ${skipped} already saved.`);
    } catch (e) {
      setError(e.message || 'Could not import GitHub repositories.');
    } finally {
      setImporting(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this repository record from ALI HUB?')) return;

    try {
      await deleteRecord(id);
      setItems(old => old.filter(x => x.id !== id));
      if (editing === id) cancelEdit();
    } catch (e) {
      setError(e.message);
    }
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter(item =>
      JSON.stringify({ title: item.title, ...item.payload })
        .toLowerCase().includes(term)
    );
  }, [items, search]);

  const starred = items.filter(x => x.payload?.is_starred).length;
  const privateCount = items.filter(x => x.payload?.private).length;

  return (
    <div className="module">
      <div className="module-head">
        <div>
          <h2><Github size={22} /> Repositories</h2>
          <p>Manage your GitHub repositories and development projects.</p>
        </div>
        <span className="count-pill">{items.length} saved</span>
      </div>

      <div className="record-grid">
        <article className="record-card">
          <h3>{items.length}</h3>
          <p>Total Repositories</p>
        </article>
        <article className="record-card">
          <h3>{starred}</h3>
          <p>Important / Starred</p>
        </article>
        <article className="record-card">
          <h3>{privateCount}</h3>
          <p>Private Repositories</p>
        </article>
      </div>

      <div className="form-card">
        <h3>GitHub Connection</h3>
        <p className="muted">Fetch repositories from your connected GitHub account and save them in ALI HUB.</p>
        <button type="button" className="primary"
          onClick={importFromGitHub} disabled={importing}>
          {importing ? <LoaderCircle className="spin" /> : <RefreshCw size={17} />}
          {importing ? 'Importing...' : 'Import from GitHub'}
        </button>
      </div>

      <form className="form-card" onSubmit={save}>
        <h3>{editing ? 'Edit Repository' : 'Add Repository Manually'}</h3>

        <label>
          Repository Name
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. ai-learning-hub" required />
        </label>

        <label>
          GitHub Repository URL
          <input type="url" value={values.url}
            onChange={e => change('url', e.target.value)}
            placeholder="https://github.com/username/repository" />
        </label>

        <label>
          Description
          <textarea rows="3" value={values.description}
            onChange={e => change('description', e.target.value)}
            placeholder="What does this repository contain?" />
        </label>

        <div className="form-grid">
          <label>
            Language / Tech Stack
            <input value={values.technology}
              onChange={e => change('technology', e.target.value)}
              placeholder="Python, C++, React..." />
          </label>

          <label>
            Status
            <select value={values.status}
              onChange={e => change('status', e.target.value)}>
              <option>Active</option>
              <option>Learning</option>
              <option>In Development</option>
              <option>Completed</option>
              <option>Archived</option>
            </select>
          </label>
        </div>

        <label className="checkbox-label">
          <input type="checkbox" checked={values.is_starred}
            onChange={e => change('is_starred', e.target.checked)} />
          Mark as important
        </label>

        <div className="form-actions">
          <button className="primary" disabled={saving}>
            {saving ? <LoaderCircle className="spin" /> : <Plus size={17} />}
            {editing ? 'Update Repository' : 'Save Repository'}
          </button>
          {editing && (
            <button type="button" className="secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search repositories..." />
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="muted">{notice}</p>}

      {busy ? <p className="muted">Loading repositories...</p> : (
        <div className="record-grid">
          {filtered.map(item => {
            const p = item.payload || {};
            const url = p.github_url || p.url || '';

            return (
              <article className="record-card" key={item.id}>
                <div className="record-title">
                  <h3>{item.title}</h3>
                  <div className="record-actions">
                    <button className="secondary small-button"
                      onClick={() => edit(item)}>Edit</button>
                    <button className="icon danger"
                      onClick={() => remove(item.id)} title="Delete">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                {p.is_starred && <p><Star size={14} /> Important</p>}
                <p><b>Language:</b> {p.language || p.technology || 'Not specified'}</p>
                <p><b>Status:</b> {p.status || 'Active'}</p>
                {p.description && <p>{p.description}</p>}
                {p.stars !== undefined && <p><b>GitHub stars:</b> {p.stars}</p>}
                {p.visibility && <p><b>Visibility:</b> {p.visibility}</p>}
                {p.default_branch && <p><b>Default branch:</b> {p.default_branch}</p>}

                {url && /^https?:\/\//i.test(url) && (
                  <a href={url} target="_blank" rel="noreferrer">
                    <Github size={15} /> Open on GitHub <ExternalLink size={13} />
                  </a>
                )}
              </article>
            );
          })}

          {!filtered.length && (
            <div className="empty">
              {search ? 'No matching repositories.' : 'No repositories saved yet. Import from GitHub or add one manually.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
