import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, ExternalLink, LoaderCircle, Globe, Github } from 'lucide-react';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/records';

const initial = {
  url: '',
  description: '',
  platform: 'Vercel',
  category: 'Portfolio',
  status: 'Live',
  github_url: '',
  notes: ''
};

export default function Websites({ user }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [values, setValues] = useState(initial);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setItems(await listRecords(user.id, 'websites'));
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
      url: p.url || '',
      description: p.description || '',
      platform: p.platform || 'Other',
      category: p.category || 'Website',
      status: p.status || 'Live',
      github_url: p.github_url || '',
      notes: p.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        ...values,
        url: values.url.trim(),
        github_url: values.github_url.trim(),
        description: values.description.trim(),
        notes: values.notes.trim()
      };

      if (editing) {
        const row = await updateRecord(editing, {
          title: title.trim(),
          payload
        });
        setItems(old => old.map(x => x.id === editing ? row : x));
      } else {
        const row = await createRecord(user.id, 'websites', title.trim(), payload);
        setItems(old => [row, ...old]);
      }

      cancelEdit();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this website record?')) return;
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

  const live = items.filter(x => (x.payload?.status || 'Live') === 'Live').length;

  return (
    <div className="module">
      <div className="module-head">
        <div>
          <h2><Globe size={22} /> My Websites</h2>
          <p>Manage your portfolio, published websites and deployment links.</p>
        </div>
        <span className="count-pill">{items.length} websites</span>
      </div>

      <div className="record-grid">
        <article className="record-card">
          <h3>{items.length}</h3>
          <p>Total Websites</p>
        </article>
        <article className="record-card">
          <h3>{live}</h3>
          <p>Live Websites</p>
        </article>
        <article className="record-card">
          <h3>{items.length - live}</h3>
          <p>In Development</p>
        </article>
      </div>

      <form className="form-card" onSubmit={save}>
        <h3>{editing ? 'Edit Website' : 'Add New Website'}</h3>

        <label>
          Website Name
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. My AI Portfolio" required />
        </label>

        <label>
          Live Website URL
          <input type="url" value={values.url}
            onChange={e => change('url', e.target.value)}
            placeholder="https://yourwebsite.vercel.app" />
        </label>

        <label>
          Description
          <textarea rows="3" value={values.description}
            onChange={e => change('description', e.target.value)}
            placeholder="Describe your website..." />
        </label>

        <div className="form-grid">
          <label>
            Platform
            <select value={values.platform}
              onChange={e => change('platform', e.target.value)}>
              <option>Vercel</option>
              <option>GitHub Pages</option>
              <option>Netlify</option>
              <option>Firebase</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Category
            <select value={values.category}
              onChange={e => change('category', e.target.value)}>
              <option>Portfolio</option>
              <option>University Project</option>
              <option>AI Project</option>
              <option>Business</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Website Status
            <select value={values.status}
              onChange={e => change('status', e.target.value)}>
              <option>Live</option>
              <option>In Development</option>
              <option>Paused</option>
            </select>
          </label>
        </div>

        <label>
          GitHub Repository URL
          <input type="url" value={values.github_url}
            onChange={e => change('github_url', e.target.value)}
            placeholder="https://github.com/username/repository" />
        </label>

        <label>
          Notes
          <textarea rows="3" value={values.notes}
            onChange={e => change('notes', e.target.value)}
            placeholder="Additional information..." />
        </label>

        <div className="form-actions">
          <button className="primary" disabled={saving}>
            {saving ? <LoaderCircle className="spin" /> : <Plus size={17} />}
            {editing ? 'Update Website' : 'Save Website'}
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
            placeholder="Search websites..." />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {busy ? <p className="muted">Loading websites...</p> : (
        <div className="record-grid">
          {filtered.map(item => {
            const p = item.payload || {};
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

                <p><b>Status:</b> {p.status || 'Live'}</p>
                <p><b>Platform:</b> {p.platform || 'Not specified'}</p>
                <p><b>Category:</b> {p.category || 'Website'}</p>
                {p.description && <p>{p.description}</p>}
                {p.notes && <p><b>Notes:</b> {p.notes}</p>}

                <div className="form-actions">
                  {p.url && /^https?:\/\//i.test(p.url) && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      <Globe size={15} /> Open Website <ExternalLink size={13} />
                    </a>
                  )}
                  {p.github_url && /^https?:\/\//i.test(p.github_url) && (
                    <a href={p.github_url} target="_blank" rel="noreferrer">
                      <Github size={15} /> GitHub <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}

          {!filtered.length && (
            <div className="empty">
              {search ? 'No matching websites.' : 'No websites saved yet. Add your first website above.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
