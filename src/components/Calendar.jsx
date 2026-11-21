import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Clock, MapPin, X } from 'lucide-react';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/records';

const categories = ['Class', 'Meeting', 'Personal', 'University', 'Deadline'];

const emptyForm = {
  event_date: new Date().toISOString().slice(0, 10),
  event_time: '',
  category: 'Personal',
  location: '',
  description: ''
};

const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export default function Calendar({ user }) {
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(dateKey(new Date()));
  const [form, setForm] = useState(emptyForm);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setItems(await listRecords(user.id, 'events'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { refresh(); }, [user.id]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;

  const eventsByDate = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const date = item.payload?.event_date;
      if (date) (map[date] ||= []).push(item);
    });
    return map;
  }, [items]);

  const selectedEvents = eventsByDate[selected] || [];

  const upcoming = useMemo(() => items
    .filter(x => x.payload?.event_date >= dateKey(new Date()))
    .sort((a,b) => {
      const da = `${a.payload.event_date} ${a.payload.event_time || ''}`;
      const db = `${b.payload.event_date} ${b.payload.event_time || ''}`;
      return da.localeCompare(db);
    }).slice(0, 6), [items]);

  function openNew(date = selected) {
    setEditing(null);
    setTitle('');
    setForm({ ...emptyForm, event_date: date });
    setShowForm(true);
    setError('');
  }

  function openEdit(item) {
    setEditing(item.id);
    setTitle(item.title || '');
    setForm({ ...emptyForm, ...(item.payload || {}) });
    setShowForm(true);
    setError('');
  }

  async function save(e) {
    e.preventDefault();
    if (!title.trim() || !form.event_date) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (editing) {
        const row = await updateRecord(editing, { title: title.trim(), payload });
        setItems(old => old.map(x => x.id === editing ? row : x));
      } else {
        const row = await createRecord(user.id, 'events', title.trim(), payload);
        setItems(old => [row, ...old]);
      }
      setSelected(form.event_date);
      setMonth(new Date(`${form.event_date}T12:00:00`));
      setShowForm(false);
      setEditing(null);
      setTitle('');
      setForm(emptyForm);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this event?')) return;
    try {
      await deleteRecord(id);
      setItems(old => old.filter(x => x.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  function changeMonth(amount) {
    setMonth(new Date(year, monthIndex + amount, 1));
  }

  const cells = Array.from({ length: offset + daysInMonth }, (_, i) =>
    i < offset ? null : i - offset + 1
  );

  return (
    <div className="module">
      <div className="module-head">
        <div>
          <h2>My Calendar</h2>
          <p>Organize classes, meetings, deadlines and personal events.</p>
        </div>
        <button className="primary" onClick={() => openNew()}>
          <Plus size={17}/> Add Event
        </button>
      </div>

      {error && <div className="notice">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <CalendarDays/><strong>{items.length}</strong><span>Total Events</span>
        </div>
        <div className="stat-card">
          <Clock/><strong>{upcoming.length}</strong><span>Upcoming Events</span>
        </div>
        <div className="stat-card">
          <CalendarDays/><strong>{(eventsByDate[selected] || []).length}</strong><span>Selected Day</span>
        </div>
      </div>

      <div className="record-card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button className="secondary" onClick={() => changeMonth(-1)}><ChevronLeft size={18}/> Previous</button>
          <h2>{month.toLocaleDateString('en-US', { month:'long', year:'numeric' })}</h2>
          <button className="secondary" onClick={() => changeMonth(1)}>Next <ChevronRight size={18}/></button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:6, marginTop:18 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day =>
            <div key={day} style={{ textAlign:'center', fontWeight:700, padding:8 }}>{day}</div>
          )}
          {cells.map((day, i) => {
            const key = day ? dateKey(new Date(year, monthIndex, day)) : `empty-${i}`;
            const events = day ? eventsByDate[key] || [] : [];
            const active = key === selected;
            const today = key === dateKey(new Date());

            return (
              <button key={key} disabled={!day} onClick={() => setSelected(key)}
                style={{
                  minHeight:85, padding:6, borderRadius:10,
                  border: active ? '2px solid var(--accent, #6366f1)' : '1px solid var(--border, #ddd)',
                  background: active ? 'var(--surface, #f0f0ff)' : 'transparent',
                  color:'inherit', textAlign:'left', cursor:day?'pointer':'default'
                }}>
                {day && <>
                  <strong style={{ display:'block', color:today?'#6366f1':'inherit' }}>{day}</strong>
                  {events.slice(0,2).map(event =>
                    <span key={event.id} style={{
                      display:'block', fontSize:10, padding:'3px 4px',
                      borderRadius:4, marginTop:3, background:'#6366f122',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                    }}>{event.title}</span>
                  )}
                  {events.length > 2 && <small>+{events.length-2} more</small>}
                </>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="record-card">
        <div className="section-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h2>{new Date(`${selected}T12:00:00`).toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2>
            <p className="muted">Events for selected date</p>
          </div>
          <button className="primary" onClick={() => openNew(selected)}><Plus size={16}/> Add</button>
        </div>

        {selectedEvents.length === 0 ? <p className="muted">No events on this date.</p> :
          selectedEvents.map(item => (
            <article className="record-card" key={item.id} style={{ marginTop:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                <div>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.payload?.category || 'Personal'}</p>
                  {item.payload?.event_time && <p><Clock size={14}/> {item.payload.event_time}</p>}
                  {item.payload?.location && <p><MapPin size={14}/> {item.payload.location}</p>}
                  {item.payload?.description && <p>{item.payload.description}</p>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="secondary" onClick={() => openEdit(item)} title="Edit"><Pencil size={16}/></button>
                  <button className="secondary" onClick={() => remove(item.id)} title="Delete"><Trash2 size={16}/></button>
                </div>
              </div>
            </article>
          ))
        }
      </div>

      <div className="record-card" style={{ marginTop:20 }}>
        <h2>Upcoming Events</h2>
        {upcoming.length === 0 ? <p className="muted">No upcoming events.</p> :
          upcoming.map(item => (
            <button key={item.id} onClick={() => {
              setSelected(item.payload.event_date);
              setMonth(new Date(`${item.payload.event_date}T12:00:00`));
            }} style={{ display:'flex', width:'100%', justifyContent:'space-between', padding:12, border:0, borderBottom:'1px solid var(--border,#ddd)', background:'transparent', color:'inherit', cursor:'pointer', textAlign:'left' }}>
              <span><b>{item.title}</b><small style={{ display:'block' }}>{item.payload?.category || 'Personal'}</small></span>
              <span>{item.payload.event_date} {item.payload.event_time || ''}</span>
            </button>
          ))
        }
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'#0009', display:'grid', placeItems:'center', padding:16 }}>
          <form className="record-card" onSubmit={save} style={{ width:'min(520px,100%)', maxHeight:'90vh', overflowY:'auto', background:'var(--card, white)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2>{editing ? 'Edit Event' : 'Add Event'}</h2>
              <button type="button" className="secondary" onClick={() => setShowForm(false)}><X size={18}/></button>
            </div>

            <label>Event title</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter event title"/>

            <label>Date</label>
            <input required type="date" value={form.event_date} onChange={e => setForm({...form,event_date:e.target.value})}/>

            <label>Time</label>
            <input type="time" value={form.event_time} onChange={e => setForm({...form,event_time:e.target.value})}/>

            <label>Category</label>
            <select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>

            <label>Location</label>
            <input value={form.location} onChange={e => setForm({...form,location:e.target.value})} placeholder="Optional location"/>

            <label>Details</label>
            <textarea rows="3" value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Event details..."/>

            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button className="primary" disabled={saving}>{saving?'Saving...':'Save Event'}</button>
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {busy && <p className="muted">Loading calendar...</p>}
    </div>
  );
}
