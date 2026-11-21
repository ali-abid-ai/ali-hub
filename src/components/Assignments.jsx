import { useEffect, useState } from 'react';
import { Plus, Trash2, Upload, Download, Pencil, X, FileText } from 'lucide-react';
import { createRecord, listRecords, updateRecord, deleteRecord } from '../lib/records';
import { saveFile, getFile, deleteFile, formatBytes } from '../lib/offlineStore';
import { supabase } from '../lib/supabase';

const empty = {subject:'',description:'',deadline:'',priority:'Medium',status:'Pending'};

export default function Assignments({user}) {
  const [items,setItems]=useState([]);
  const [title,setTitle]=useState('');
  const [values,setValues]=useState(empty);
  const [file,setFile]=useState(null);
  const [editing,setEditing]=useState(null);
  const [busy,setBusy]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');

  async function refresh(){
    setBusy(true);
    try{setItems(await listRecords(user.id,'assignments'));}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  useEffect(()=>{refresh();},[user.id]);

  function reset(){
    setTitle('');setValues(empty);setFile(null);setEditing(null);
  }

  async function save(e){
    e.preventDefault();
    if(!title.trim())return;
    setSaving(true);setError('');
    let fileId=null;
    try{
      let attachment=editing?.payload?.attachment||null;

      if(file){
        if(file.size>50*1024*1024)throw new Error('File size must be 50 MB or less.');
        const allowed=/\.(pdf|docx|doc|pptx|ppt|xlsx|xls|txt|png|jpg|jpeg|webp)$/i;
        if(!allowed.test(file.name))throw new Error('Supported: PDF, Word, PowerPoint, Excel, TXT and images.');
        fileId=crypto.randomUUID();
        await saveFile(fileId,file,{name:file.name,mime_type:file.type,size:file.size});
        attachment={local_file_id:fileId,name:file.name,type:file.type,size:file.size,storage_path:null};
      }

      const payload={...values,attachment};
      if(editing){
        const row=await updateRecord(editing.id,{title:title.trim(),payload});
        setItems(old=>old.map(x=>x.id===row.id?row:x));
      }else{
        const row=await createRecord(user.id,'assignments',title.trim(),payload);
        setItems(old=>[row,...old]);
      }
      reset();
    }catch(e){
      if(fileId)await deleteFile(fileId).catch(()=>{});
      setError(e.message||'Could not save assignment.');
    }finally{setSaving(false);}
  }

  function edit(item){
    setEditing(item);setTitle(item.title);
    setValues({...empty,...item.payload});
    setFile(null);window.scrollTo({top:0,behavior:'smooth'});
  }

  async function remove(item){
    if(!confirm('Delete this assignment and its attached file?'))return;
    try{
      await deleteRecord(item.id);
      if(item.payload?.attachment?.local_file_id)
        await deleteFile(item.payload.attachment.local_file_id);
      setItems(old=>old.filter(x=>x.id!==item.id));
    }catch(e){setError(e.message);}
  }

  async function download(item){
    try{
      const a=item.payload?.attachment;
      if(!a)throw new Error('No file attached.');
      const local=a.local_file_id?await getFile(a.local_file_id):null;
      if(local?.file){
        const url=URL.createObjectURL(local.file);
        const link=document.createElement('a');
        link.href=url;link.download=a.name;link.click();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
        return;
      }
      if(a.storage_path&&supabase){
        const {data,error}=await supabase.storage.from('ali-hub-documents').createSignedUrl(a.storage_path,60);
        if(error)throw error;
        window.open(data.signedUrl,'_blank','noopener,noreferrer');
        return;
      }
      throw new Error('File is not available on this device or in cloud storage.');
    }catch(e){setError(e.message);}
  }

  const filtered=items.filter(x=>JSON.stringify({title:x.title,...x.payload}).toLowerCase().includes(search.toLowerCase()));
  const counts={
    pending:items.filter(x=>x.payload?.status==='Pending').length,
    progress:items.filter(x=>x.payload?.status==='In Progress').length,
    submitted:items.filter(x=>x.payload?.status==='Submitted').length
  };

  return <div className="module">
    <div className="module-head">
      <div><h2>Assignments</h2><p>Manage university assignments, deadlines and attached files.</p></div>
      <span className="count-pill">{items.length} assignments</span>
    </div>

    <div className="record-grid">
      <article className="record-card"><b>Pending</b><h2>{counts.pending}</h2></article>
      <article className="record-card"><b>In Progress</b><h2>{counts.progress}</h2></article>
      <article className="record-card"><b>Submitted</b><h2>{counts.submitted}</h2></article>
    </div>

    <form className="form-card" onSubmit={save}>
      <h3>{editing?'Edit Assignment':'Add Assignment'}</h3>
      <label>Assignment title
        <input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Enter assignment title"/>
      </label>
      <label>Subject
        <input value={values.subject} onChange={e=>setValues({...values,subject:e.target.value})} placeholder="Subject name"/>
      </label>
      <label>Description / Instructions
        <textarea rows="4" value={values.description} onChange={e=>setValues({...values,description:e.target.value})} placeholder="Assignment details and instructions..."/>
      </label>
      <label>Due date
        <input type="date" value={values.deadline} onChange={e=>setValues({...values,deadline:e.target.value})}/>
      </label>
      <label>Priority
        <select value={values.priority} onChange={e=>setValues({...values,priority:e.target.value})}>
          <option>Low</option><option>Medium</option><option>High</option>
        </select>
      </label>
      <label>Submission status
        <select value={values.status} onChange={e=>setValues({...values,status:e.target.value})}>
          <option>Pending</option><option>In Progress</option><option>Submitted</option>
        </select>
      </label>
      {!editing?.payload?.attachment&&<label>Attach file (optional)
        <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp" onChange={e=>setFile(e.target.files?.[0]||null)}/>
        <small className="muted">PDF, Word, PowerPoint, Excel, TXT or images · Max 50 MB</small>
      </label>}
      {editing?.payload?.attachment&&<p className="notice">Existing file: {editing.payload.attachment.name} (preserved)</p>}
      {file&&<p className="muted">{file.name} · {formatBytes(file.size)}</p>}
      <div className="form-actions">
        <button className="primary" disabled={saving}>{saving?'Saving...':<><Plus size={16}/> {editing?'Update Assignment':'Save Assignment'}</>}</button>
        {editing&&<button type="button" className="secondary" onClick={reset}><X size={16}/> Cancel</button>}
      </div>
    </form>

    <div className="toolbar">
      <div className="search-input"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assignments..."/></div>
    </div>
    {error&&<p className="error">{error}</p>}
    {busy?<p className="muted">Loading assignments...</p>:<div className="record-grid">
      {filtered.map(item=><article className="record-card" key={item.id}>
        <div className="record-title"><h3>{item.title}</h3>
          <div className="record-actions">
            <button className="secondary small-button" onClick={()=>edit(item)}><Pencil size={15}/></button>
            <button className="icon danger" onClick={()=>remove(item)}><Trash2 size={17}/></button>
          </div>
        </div>
        <p><b>Subject:</b> {item.payload?.subject||'—'}</p>
        <p><b>Due:</b> {item.payload?.deadline||'Not set'}</p>
        <p><b>Priority:</b> {item.payload?.priority||'Medium'}</p>
        <p><b>Status:</b> {item.payload?.status||'Pending'}</p>
        {item.payload?.description&&<p>{item.payload.description}</p>}
        {item.payload?.attachment&&<div className="form-actions">
          <span><FileText size={16}/> {item.payload.attachment.name}</span>
          <button className="secondary" onClick={()=>download(item)}><Download size={16}/> Download</button>
        </div>}
      </article>)}
      {!filtered.length&&<div className="empty">No assignments found.</div>}
    </div>}
  </div>;
}
