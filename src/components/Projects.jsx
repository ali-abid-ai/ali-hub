import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, ExternalLink, LoaderCircle, Github, FolderKanban } from 'lucide-react';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/records';

const emptyForm = {
  description: '',
  tech_stack: '',
  status: 'Planning',
  progress: 0,
  github_url: '',
  demo_url: '',
  start_date: '',
  completion_date: '',
  notes: ''
};

export default function Projects({ user }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [values, setValues] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setItems(await listRecords(user.id, 'projects'));
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
    setValues(previous => ({ ...previous, [key]: value }));
  }

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) return;

    const progress = Number(values.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      setError('Progress 0 se 100 ke darmiyan honi chahiye.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      ...values,
      progress,
      description: values.description.trim(),
      tech_stack: values.tech_stack.trim(),
      github_url: values.github_url.trim(),
      demo_url: values.demo_url.trim(),
      notes: values.notes.trim()
    };

    try {
      if (editing) {
        const row = await updateRecord(editing, {
          title: title.trim(),
          payload
        });
        setItems(previous => previous.map(item => item.id === editing ? row : item));
      } else {
        const row = await createRecord(user.id, 'projects', title.trim(), payload);
        setItems(previous => [row, ...previous]);
      }

      cancelEdit();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item) {
    const old = item.payload || {};

    setEditing(item.id);
    setTitle(item.title || '');
    setValues({
      ...emptyForm,
      ...old,
      description: old.description || '',
      tech_stack: old.tech_stack || old.technology || '',
      status: old.status || 'Planning',
      progress: old.progress ?? 0,
      github_url: old.github_url || (
        old.url && /github\.com/i.test(old.url) ? old.url : ''
      ),
      demo_url: old.demo_url || (
        old.url && !/github\.com/i.test(old.url) ? old.url : ''
      ),
      start_date: old.start_date || '',
      completion_date: old.completion_date || '',
      notes: old.notes || old.description || ''
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(null);
    setTitle('');
    setValues(emptyForm);
  }

  async function remove(id) {
    if (!confirm('Delete this project?')) return;

    try {
      await deleteRecord(id);
      setItems(previous => previous.filter(item => item.id !== id));
      if (editing === id) cancelEdit();
    } catch (e) {
      setError(e.message);
    }
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter(item =>
      JSON.stringify({ title: item.title, ...item.payload })
        .toLowerCase()
        .includes(term)
    );
  }, [items, search]);

  const completed = items.filter(x => x.payload?.status === 'Completed').length;
  const active = items.filter(x => x.payload?.status === 'In Progress').length;

  return (
    <div className="module">
      <div className="module-head">
        <div>
          <h2><FolderKanban size={22} /> My Projects</h2>
          <p>Manage your university, personal and AI development projects.</p>
        </div>
        <span className="count-pill">{items.length} projects</span>
      </div>

      <div className="record-grid">
        <article className="record-card">
          <h3>{items.length}</h3>
          <p>Total Projects</p>
        </article>
        <article className="record-card">
          <h3>{active}</h3>
          <p>In Progress</p>
        </article>
        <article className="record-card">
          <h3>{completed}</h3>
          <p>Completed</p>
        </article>
      </div>

      <form className="form-card" onSubmit={save}>
        <h3>{editing ? 'Edit Project' : 'Add New Project'}</h3>

        <label>
          Project Title
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. ALI HUB"
            required
          />
        </label>

        <label>
          Description
          <textarea rows="3" value={values.description}
            onChange={e => change('description', e.target.value)}
            placeholder="What is this project about?" />
        </label>

        <label>
          Technologies / Tech Stack
          <input value={values.tech_stack}
            onChange={e => change('tech_stack', e.target.value)}
            placeholder="React, Python, FastAPI, Supabase..." />
        </label>

        <div className="form-grid">
          <label>
            Project Status
            <select value={values.status}
              onChange={e => change('status', e.target.value)}>
              <option>Planning</option>
              <option>In Progress</option>
              <option>On Hold</option>
              <option>Completed</option>
            </select>
          </label>

          <label>
            Progress (%)
            <input type="number" min="0" max="100"
              value={values.progress}
              onChange={e => change('progress', e.target.value)} />
          </label>

          <label>
            Start Date
            <input type="date" value={values.start_date}
              onChange={e => change('start_date', e.target.value)} />
          </label>

          <label>
            Completion Date
            <input type="date" value={values.completion_date}
              onChange={e => change('completion_date', e.target.value)} />
          </label>
        </div>

        <label>
          GitHub Repository URL
          <input type="url" value={values.github_url}
            onChange={e => change('github_url', e.target.value)}
            placeholder="https://github.com/username/project" />
        </label>

        <label>
          Live Demo URL
          <input type="url" value={values.demo_url}
            onChange={e => change('demo_url', e.target.value)}
            placeholder="https://your-project.vercel.app" />
        </label>

        <label>
          Project Notes
          <textarea rows="3" value={values.notes}
            onChange={e => change('notes', e.target.value)}
            placeholder="Ideas, next steps and additional details..." />
        </label>

        <div className="form-actions">
          <button className="primary" disabled={saving}>
            {saving ? <LoaderCircle className="spin" /> : <Plus size={17} />}
            {editing ? 'Update Project' : 'Save Project'}
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
            placeholder="Search projects..." />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {busy ? (
        <p className="muted">Loading projects...</p>
      ) : (
        <div className="record-grid">
          {filtered.map(item => {
            const p = item.payload || {};
            const github = p.github_url || (
              /github\.com/i.test(p.url || '') ? p.url : ''
            );
            const demo = p.demo_url || (
              p.url && !/github\.com/i.test(p.url) ? p.url : ''
            );

            return (
              <article className="record-card" key={item.id}>
                <div className="record-title">
                  <h3>{item.title}</h3>
                  <div className="record-actions">
                    <button className="secondary small-button"
                      onClick={() => startEdit(item)}>Edit</button>
                    <button className="icon danger"
                      onClick={() => remove(item.id)} title="Delete">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <p><b>Status:</b> {p.status || 'Not specified'}</p>
                <p><b>Progress:</b> {p.progress ?? 0}%</p>

                <div className="progress-track">
                  <div className="progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, Number(p.progress) || 0))}%` }} />
                </div>

                {p.description && <p>{p.description}</p>}
                {(p.tech_stack || p.technology) &&
                  <p><b>Tech Stack:</b> {p.tech_stack || p.technology}</p>}
                {p.start_date && <p><b>Started:</b> {p.start_date}</p>}
                {p.completion_date && <p><b>Completed:</b> {p.completion_date}</p>}
                {p.notes && <p><b>Notes:</b> {p.notes}</p>}

                <div className="form-actions">
                  {github && /^https?:\/\//i.test(github) &&
                    <a href={github} target="_blank" rel="noreferrer">
                      <Github size={15} /> GitHub <ExternalLink size={13} />
                    </a>}
                  {demo && /^https?:\/\//i.test(demo) &&
                    <a href={demo} target="_blank" rel="noreferrer">
                      Live Demo <ExternalLink size={13} />
                    </a>}
                </div>
              </article>
            );
          })}

          {!filtered.length &&
            <div className="empty">
              {search ? 'No matching projects.' : 'No projects yet. Add your first project above.'}
            </div>}
        </div>
      )}
    </div>
  );
}
