import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, ExternalLink, LoaderCircle, Upload, Download } from 'lucide-react';
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/records';
import { supabase } from '../lib/supabase';
import { saveFile, getFile, deleteFile } from '../lib/offlineStore';

const configs = {
  'Knowledge Vault': { section:'knowledge', description:'Save useful AI answers, research, ideas and personal notes.', fields:[['content','Knowledge / notes','textarea']] },
  'Quizzes': { section:'quizzes', description:'Organize quiz topics, dates, marks and preparation status.', fields:[['subject','Subject'],['date','Quiz date','date'],['status','Preparation status']] },
  'Assignments': { section:'assignments', description:'Track assignment deadlines, subjects and submission status.', fields:[['subject','Subject'],['deadline','Due date','date'],['status','Status']] },
  'My Websites': { section:'websites', description:'Save your portfolio, published websites and useful links.', fields:[['url','Website URL','url'],['description','Description','textarea']] },
  'Repositories': { section:'repositories', description:'Keep GitHub repositories and development links organized.', fields:[['url','Repository URL','url'],['technology','Technology'],['description','Description','textarea']] },
  'My Projects': { section:'projects', description:'Track personal, university and AI projects.', fields:[['status','Project status'],['progress','Progress (%)','number'],['url','Project link','url'],['description','Project notes','textarea']] },
  'Tasks': { section:'tasks', description:'Track personal tasks, priorities and due dates.', fields:[['priority','Priority'],['due_date','Due date','date'],['status','Status']] },
  'Calendar': { section:'events', description:'Save important events, classes, meetings and deadlines.', fields:[['event_date','Date','date'],['event_time','Time','time'],['description','Details','textarea']] }
};
export default function RecordsModule({ name, user }) {
  const config = configs[name];
  const [items,setItems] = useState([]); const [title,setTitle] = useState(''); const [values,setValues] = useState({});
  const [search,setSearch] = useState(''); const [busy,setBusy] = useState(true); const [saving,setSaving] = useState(false); const [error,setError] = useState(''); const [editing,setEditing] = useState(null);
  async function refresh(){ setBusy(true); setError(''); try { setItems(await listRecords(user.id,config.section)); } catch(e){setError(e.message);} finally{setBusy(false);} }
  useEffect(()=>{refresh();},[user.id,name]);
  const filtered = useMemo(()=>items.filter(x=>JSON.stringify({title:x.title,...x.payload}).toLowerCase().includes(search.toLowerCase())),[items,search]);
  async function add(e){ e.preventDefault(); if(!title.trim())return; setSaving(true);setError(''); try { if(editing){const row=await updateRecord(editing,{title:title.trim(),payload:values});setItems(items.map(x=>x.id===editing?row:x));setEditing(null);}else{const row=await createRecord(user.id,config.section,title.trim(),values);setItems([row,...items]);}setTitle('');setValues({}); } catch(e){setError(e.message);} finally{setSaving(false);} }
  function startEdit(item){setEditing(item.id);setTitle(item.title);setValues(item.payload||{});window.scrollTo({top:0,behavior:'smooth'});}
  function cancelEdit(){setEditing(null);setTitle('');setValues({});}
  async function remove(id){ if(!confirm('Delete this item?'))return; try{await deleteRecord(id);setItems(items.filter(x=>x.id!==id));}catch(e){setError(e.message);} }
  return <div className="module"><div className="module-head"><div><h2>{name}</h2><p>{config.description}</p></div><span className="count-pill">{items.length} saved</span></div>
    <form className="form-card" onSubmit={add}><label>Title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder={`Enter ${name.toLowerCase()} title`} required/></label>
      {config.fields.map(([key,label,type])=><label key={key}>{label}{type==='textarea'?<textarea rows="4" value={values[key]||''} onChange={e=>setValues({...values,[key]:e.target.value})}/>:<input type={type||'text'} value={values[key]||''} onChange={e=>setValues({...values,[key]:e.target.value})}/>}</label>)}
      <div className="form-actions"><button className="primary" disabled={saving}>{saving?<LoaderCircle className="spin"/>:editing?'Save changes':<Plus size={17}/>} {editing?'Update':'Save'} {name.replace('My ','')}</button>{editing&&<button type="button" className="secondary" onClick={cancelEdit}>Cancel edit</button>}</div></form>
    <div className="toolbar"><div className="search-input"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${name.toLowerCase()}...`}/></div></div>
    {error&&<p className="error">{error}</p>}{busy?<p className="muted">Loading records...</p>:<div className="record-grid">{filtered.map(item=><article className="record-card" key={item.id}><div className="record-title"><h3>{item.title}</h3><div className="record-actions"><button className="secondary small-button" onClick={()=>startEdit(item)}>Edit</button><button className="icon danger" onClick={()=>remove(item.id)} title="Delete"><Trash2 size={17}/></button></div></div>{config.fields.map(([key,label])=>item.payload?.[key]&&<p key={key}><b>{label}:</b> {item.payload[key]}</p>)}{item.payload?.url&&/^https?:\/\//i.test(item.payload.url)&&<a href={item.payload.url} target="_blank" rel="noreferrer">Open link <ExternalLink size={14}/></a>}</article>)}{!filtered.length&&<div className="empty">{search?'No matching records.':'Nothing saved yet. Add your first item above.'}</div>}</div>}</div>;
}

export function DocumentsModule({user}) {
 const [items,setItems]=useState([]),[file,setFile]=useState(null),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 async function refresh(){setBusy(true);try{setItems(await listRecords(user.id,'documents'));}catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{refresh();},[user.id]);
 async function extractText(selected){
  const name=selected.name.toLowerCase();
  if(name.endsWith('.pdf')){
   const pdfjs=await import('pdfjs-dist');
   const workerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
   pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
   const pdf=await pdfjs.getDocument({data:await selected.arrayBuffer()}).promise;const pages=[];
   for(let n=1;n<=Math.min(pdf.numPages,200);n++){const page=await pdf.getPage(n);const content=await page.getTextContent();pages.push(content.items.map(x=>x.str||'').join(' '));}
   return pages.join('\n').slice(0,120000);
  }
  if(name.endsWith('.docx')){const mammoth=await import('mammoth/mammoth.browser');const result=await mammoth.extractRawText({arrayBuffer:await selected.arrayBuffer()});return (result.value||'').slice(0,120000);}
  if(name.endsWith('.txt')||selected.type==='text/plain')return (await selected.text()).slice(0,120000);
  return '';
 }
 async function upload(e){e.preventDefault();if(!file)return;setSaving(true);setError('');setStatus('');try{
  if(!/\.(pdf|docx|txt)$/i.test(file.name))throw new Error('Supported formats: PDF, DOCX and TXT.');
  if(file.size>50*1024*1024)throw new Error('File size must be 50 MB or less.');
  const fileId=crypto.randomUUID();
  // Save the actual file locally before parsing it, so an offline parser failure cannot lose the upload.
  await saveFile(fileId,file,{name:file.name,mime_type:file.type,size:file.size});
  setStatus('Extracting searchable text...');let extractedText='';
  try { extractedText=await extractText(file); } catch(parseError) { console.warn('Document saved locally; text extraction can be retried later:', parseError); }
  let storage_path=null;
  if(supabase && navigator.onLine && !String(user.id).startsWith('local-')){
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');storage_path=`${user.id}/${fileId}-${safe}`;
    const {error:upErr}=await supabase.storage.from('ali-hub-documents').upload(storage_path,file,{upsert:false});
    if(upErr)storage_path=null; // local copy remains available if cloud upload is unavailable
  }
  try{const row=await createRecord(user.id,'documents',file.name,{local_file_id:fileId,storage_path,mime_type:file.type,size:file.size,extracted_text:extractedText,extraction_status:extractedText?'ready':'no_text'});setItems([row,...items]);setFile(null);e.target.reset();setStatus(extractedText?`Saved on this device. ${extractedText.length.toLocaleString()} characters are searchable by ALI HUB AI.`:'Saved on this device, but no selectable text was found.');}
  catch(dbError){await deleteFile(fileId).catch(()=>{});if(storage_path&&supabase){await supabase.storage.from('ali-hub-documents').remove([storage_path]).catch(()=>{});}throw dbError;}
 }catch(err){setError(err.message||'Upload failed.');}finally{setSaving(false);}}
 async function download(item){try{const local= item.payload?.local_file_id ? await getFile(item.payload.local_file_id) : null;if(local?.file){const url=URL.createObjectURL(local.file);const a=document.createElement('a');a.href=url;a.download=item.title;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}if(item.payload?.storage_path&&supabase){const {data,error}=await supabase.storage.from('ali-hub-documents').createSignedUrl(item.payload.storage_path,60);if(error)throw error;window.open(data.signedUrl,'_blank','noopener,noreferrer');return;}throw new Error('This document has no local copy. Connect to the internet to retrieve its cloud copy.');}catch(e){setError(e.message);}}
 async function indexExisting(item){setSaving(true);setError('');setStatus(`Extracting ${item.title}...`);try{let blob;const local=item.payload?.local_file_id?await getFile(item.payload.local_file_id):null;if(local?.file)blob=local.file;else if(item.payload?.storage_path&&supabase){const {data,error}=await supabase.storage.from('ali-hub-documents').createSignedUrl(item.payload.storage_path,60);if(error)throw error;const response=await fetch(data.signedUrl);if(!response.ok)throw new Error('Could not download this private file for text extraction.');blob=await response.blob();}else throw new Error('The document file is not available on this device.');const extractedText=await extractText(new File([blob],item.title,{type:item.payload?.mime_type||blob.type}));if(!extractedText)throw new Error('No selectable text found. Scanned PDFs need OCR and cannot be indexed here.');const row=await updateRecord(item.id,{payload:{...item.payload,extracted_text:extractedText,extraction_status:'ready'}});setItems(items.map(x=>x.id===item.id?row:x));setStatus(`${item.title} is now searchable by ALI HUB AI.`);}catch(e){setError(e.message);}finally{setSaving(false);}}
 async function remove(item){if(!confirm('Delete this document?'))return;try{await deleteRecord(item.id);if(item.payload?.local_file_id)await deleteFile(item.payload.local_file_id);setItems(items.filter(x=>x.id!==item.id));setStatus('Document removed from this device. Any cloud copy is queued for removal when sync is available.');}catch(e){setError(e.message);}}
 return <div className="module"><div className="module-head"><div><h2>Documents</h2><p>Local-first document storage with searchable text for your AI Assistant.</p></div><span className="count-pill">{items.length} files</span></div><form className="form-card" onSubmit={upload}><label>Select a document<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={e=>setFile(e.target.files?.[0]||null)} required/></label><p className="muted small">Supported: PDF, DOCX and TXT · Maximum 50 MB. Files are saved locally first; text extraction is attempted in your browser for AI search.</p><button className="primary" disabled={!file||saving}>{saving?<LoaderCircle className="spin"/>:<Upload size={17}/>} {saving?'Processing...':'Upload document'}</button>{status&&<p className="notice">{status}</p>}</form>{error&&<p className="error">{error}</p>}{busy?<p className="muted">Loading documents...</p>:<div className="record-grid">{items.map(item=><article className="record-card" key={item.id}><div className="record-title"><h3>{item.title}</h3><button className="icon danger" onClick={()=>remove(item)} title="Delete document"><Trash2 size={17}/></button></div><p className="muted small">{item.payload?.mime_type||'File'} · {Math.max(1,Math.round((item.payload?.size||0)/1024))} KB</p><p className="muted small">{item.payload?.extracted_text?'AI searchable':'Stored file · not indexed'}</p><div className="form-actions"><button className="secondary" onClick={()=>download(item)}><Download size={16}/> Download</button>{!item.payload?.extracted_text&&<button className="secondary" disabled={saving} onClick={()=>indexExisting(item)}>Make AI searchable</button>}</div></article>)}{!items.length&&<div className="empty">No documents uploaded yet.</div>}</div>}</div>;
}
