import Calendar from './components/Calendar';
import Repositories from './components/Repositories';
import Websites from './components/Websites';
import Projects from './components/Projects';
import Assignments from './components/Assignments';
import Quizzes from './components/Quizzes';
import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { LayoutDashboard,BookOpen,Brain,ClipboardCheck,FileText,Globe,GitBranch,FolderOpen,Code2,Settings,Search,Bell,Sun,Moon,Menu,X,LogOut,CalendarDays,ListTodo,Cloud,LoaderCircle,ArrowUpRight,GraduationCap,Clock } from 'lucide-react';
import { supabase,isSupabaseConfigured } from './lib/supabase';
import { getCounts,migrateLocalData,syncPending } from './lib/records';
import { storeGetAll, storeGet, storePut, storePutAndQueue, saveFile, getStorageInfo, requestPersistentStorage, formatBytes } from './lib/offlineStore';
import Auth from './components/Auth';
import AIAssistant from './components/AIAssistant';
import ReminderCenter from './components/ReminderCenter';
import Books from './Books';
import RecordsModule,{DocumentsModule} from './components/RecordsModule';
import './index.css';
const nav=[['Dashboard',LayoutDashboard],['My Books',BookOpen],['Knowledge Vault',Brain],['Quizzes',ClipboardCheck],['Assignments',FileText],['My Websites',Globe],['Repositories',GitBranch],['Documents',FolderOpen],['My Projects',Code2],['Tasks',ListTodo],['Calendar',CalendarDays],['AI Assistant',Brain],['Settings',Settings]];
export default function App(){
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[active,setActive]=useState('Dashboard'),[dark,setDark]=useState(()=>{try{return localStorage.getItem('ali-hub-theme')==='dark';}catch{return false;}}),[menu,setMenu]=useState(false),[search,setSearch]=useState(''),[counts,setCounts]=useState({}),[notice,setNotice]=useState(''),[online,setOnline]=useState(()=>typeof navigator==='undefined'?true:navigator.onLine);
 useEffect(()=>{if(!isSupabaseConfigured){setSession({user:{id:'local-user',email:'Local workspace'}});setChecking(false);return;}let alive=true;supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setChecking(false);}}).catch(()=>{if(alive){setSession({user:{id:'local-user',email:'Local workspace'}});setChecking(false);}});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);});return()=>{alive=false;subscription.unsubscribe();};},[]);
 useEffect(()=>{if(!session?.user)return;let alive=true;const refresh=async()=>{try{await migrateLocalData(session.user.id);setCounts(await getCounts(session.user.id));}catch(e){setNotice(`Local workspace is safe; sync needs attention: ${e.message}`);}};refresh();const onOnline=()=>{syncPending(session.user.id).then(refresh).catch(()=>{});};const onChange=()=>getCounts(session.user.id).then(setCounts).catch(()=>{});window.addEventListener('online',onOnline);window.addEventListener('ali-hub-data-change',onChange);return()=>{alive=false;window.removeEventListener('online',onOnline);window.removeEventListener('ali-hub-data-change',onChange);};},[session?.user?.id]);
 useEffect(()=>{const onlineHandler=()=>setOnline(true);const offlineHandler=()=>setOnline(false);window.addEventListener('online',onlineHandler);window.addEventListener('offline',offlineHandler);return()=>{window.removeEventListener('online',onlineHandler);window.removeEventListener('offline',offlineHandler);};},[]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('ali-hub-theme',dark?'dark':'light');}catch{/* Theme preference is optional; core workspace remains usable. */}},[dark]);
 useEffect(()=>{requestPersistentStorage().catch(()=>{});},[]);
 const matches=useMemo(()=>nav.filter(([n])=>n.toLowerCase().includes(search.toLowerCase())),[search]);
 if(checking)return <div className="center-screen"><LoaderCircle className="spin"/> Checking your session...</div>;
 if(!session)return <Auth onUseOffline={()=>setSession({user:{id:'local-user',email:'Local workspace'}})}/>;
 const user=session.user;
 async function logout(){if(supabase)await supabase.auth.signOut();setSession(null);setActive('Dashboard');}
 function toggleTheme(){setDark(v=>!v);}
 return <div className="app-shell"><aside className={`sidebar ${menu?'show':''}`}><div className="brand"><div className="brand-mark small-mark">A</div><div><h2>ALI HUB</h2><span>PERSONAL WORKSPACE</span></div><button className="mobile-close" onClick={()=>setMenu(false)}><X/></button></div><p className="nav-caption">WORKSPACE</p><nav>{nav.map(([name,Icon])=><button key={name} className={`nav-item ${active===name?'active':''}`} onClick={()=>{setActive(name);setMenu(false);}}><Icon size={18}/><span>{name}</span></button>)}</nav><div className="sidebar-bottom"><div className="user-row"><div className="avatar">{(user.email||'A').slice(0,1).toUpperCase()}</div><div className="user-info"><b>{user.email}</b><span>{String(user.id).startsWith('local-')?'Offline-first local account':'Cloud + offline account'}</span></div></div>{supabase&&<button className="nav-item" onClick={logout}><LogOut size={18}/><span>Sign out</span></button>}</div></aside>
 <main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={()=>setMenu(true)}><Menu/></button><div className="crumb">Workspace / <b>{active}</b></div><div className="top-actions"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a section..."/>{search&&<div className="search-pop">{matches.map(([n])=><button key={n} onClick={()=>{setActive(n);setSearch('');}}>{n}</button>)}</div>}</div><span className="cloud-indicator"><Cloud size={16}/> {online?'Online':'Offline'}</span><button className="icon" title="Toggle theme" onClick={toggleTheme}>{dark?<Sun/>:<Moon/>}</button></div></header>
 <section className="content"><ReminderCenter user={user}/><div className="welcome"><div><p className="eyebrow">YOUR PERSONAL DIGITAL SPACE</p><h1>{active==='Dashboard'?'Welcome to ALI HUB':active}</h1><p className="muted">Everything you learn, create and achieve â€” in one place.</p></div><span className="date-chip">PERSONAL WORKSPACE</span></div>{notice&&<div className="notice" onClick={()=>setNotice('')}>{notice} <button className="notice-close">Ã—</button></div>}
 {active==='Dashboard'?<Dashboard counts={counts} setActive={setActive} user={user}/>:active==='My Books'?<Books user={user}/>:active==='Knowledge Vault'?<RecordsModule name="Knowledge Vault" user={user}/>:active==='Quizzes'?<Quizzes user={user}/>:active==='Assignments'?<Assignments user={user}/>:active==='Repositories'?<Repositories user={user}/>:active==='My Websites'?<Websites user={user}/>:active==='My Projects'?<Projects user={user}/>:active==='Calendar'?<Calendar user={user}/>:active==='Documents'?<DocumentsModule user={user}/>:active==='AI Assistant'?<AIAssistant user={user}/>:active==='Settings'?<SettingsPage user={user} dark={dark} setDark={setDark}/>:<RecordsModule name={active} user={user}/>}
 <footer>ALI HUB <span>â€¢</span> Your knowledge. Your creations. Your space.</footer></section></main></div>;
}
function Dashboard({counts,setActive,user}){const cards=[['My Books','books',BookOpen],['Saved Knowledge','knowledge',Brain],['Quizzes','quizzes',ClipboardCheck],['Projects','projects',Code2],['Assignments','assignments',FileText],['Documents','documents',FolderOpen]];return <><div className="stats-grid">{cards.map(([label,key,Icon])=><div className="stat-card" key={key}><div className="stat-icon"><Icon/></div><strong>{String(counts[key]||0).padStart(2,'0')}</strong><span>{label}</span><small>Saved records</small></div>)}</div><div className="section-title"><div><h2>Quick Access</h2><p className="muted">Open a workspace section</p></div></div><div className="quick-grid">{nav.slice(1,10).map(([name,Icon])=><button className="quick-card" key={name} onClick={()=>setActive(name)}><Icon size={22}/><b>{name}</b><span>Open section <ArrowUpRight size={14}/></span></button>)}</div><div className="bottom-panels"><article className="panel"><div className="panel-title"><GraduationCap/><div><h3>My Learning Space</h3><p>Keep academic work organized</p></div></div><button className="panel-link" onClick={()=>setActive('My Books')}><BookOpen/> Books & study notes <ArrowUpRight/></button><button className="panel-link" onClick={()=>setActive('Quizzes')}><ClipboardCheck/> Quizzes & practice <ArrowUpRight/></button><button className="panel-link" onClick={()=>setActive('Assignments')}><Clock/> Assignments <ArrowUpRight/></button></article><article className="panel"><div className="panel-title"><Cloud/><div><h3>Offline-first workspace</h3><p>{user.email}</p></div></div><p className="muted">Your records are saved on this device first. When cloud sync is configured and available, pending changes can sync to your private account. Keep regular backups.</p></article></div></>;}
function SettingsPage({user,dark,setDark}){
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[restoreFile,setRestoreFile]=useState(null),[storage,setStorage]=useState(null);
 useEffect(()=>{let active=true;(async()=>{await requestPersistentStorage();const info=await getStorageInfo();if(active)setStorage(info);})();return()=>{active=false;};},[]);
 async function backup(){
  setBusy(true);setMsg('');
  try{
   const records=(await storeGetAll('records')).filter(r=>r.user_id===user.id&&!r._deleted).map(({_local,_sync_status,...r})=>r);
   const documentIds=new Set(records.map(r=>r.payload?.local_file_id).filter(Boolean));
   const videoIds=new Set(records.map(r=>r.payload?.video_file_id).filter(Boolean));
   const files=(await storeGetAll('files')).filter(f=>documentIds.has(f.id)||videoIds.has(f.id));
   const zip=new JSZip();
   zip.file('backup.json',JSON.stringify({app:'ALI HUB',version:4,exportedAt:new Date().toISOString(),records},null,2));
   let documentCount=0,videoCount=0;
   for(const entry of files){
    if(!entry.file)continue;
    const name=entry.metadata?.name||'file.bin';
    if(documentIds.has(entry.id)){
     zip.file(`documents/${entry.id}/${name}`,entry.file);
     documentCount++;
    }
    if(videoIds.has(entry.id)){
     zip.file(`videos/${entry.id}/${name}`,entry.file);
     videoCount++;
    }
   }
   const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3},streamFiles:true});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   a.href=url;
   a.download=`ali-hub-full-backup-${new Date().toISOString().slice(0,10)}.zip`;
   a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
   setMsg(`Full backup downloaded: ${records.length} records, ${documentCount} document files and ${videoCount} book videos.`);
  }catch(e){setMsg(`Backup failed: ${e.message}`);}
  finally{setBusy(false);}
 }

 async function restore(){
  if(!restoreFile)return;
  setBusy(true);setMsg('');
  try{
   let parsed;let zip=null;
   if(restoreFile.name.toLowerCase().endsWith('.zip')){
    zip=await JSZip.loadAsync(restoreFile);
    const json=zip.file('backup.json');
    if(!json)throw new Error('ZIP does not contain backup.json.');
    parsed=JSON.parse(await json.async('string'));
   }else parsed=JSON.parse(await restoreFile.text());

   if(!parsed||!Array.isArray(parsed.records))throw new Error('This file is not a valid ALI HUB backup.');
   const allowedSections=new Set(['books','knowledge','quizzes','assignments','websites','repositories','documents','projects','tasks','events']);
   if(parsed.records.some(r=>!allowedSections.has(r.section)))throw new Error('Backup contains an unsupported section.');
   if(parsed.records.length>50000)throw new Error('This backup contains too many records to restore safely in one run.');

   let totalExpanded=0;
   if(zip){
    for(const entry of Object.values(zip.files)){
     if(!entry.dir){
      totalExpanded+=Number(entry._data?.uncompressedSize||0);
      if(totalExpanded>500*1024*1024)throw new Error('Backup expands beyond the 500 MB safety limit.');
     }
    }
   }

   let fileCount=0;
   const fileMap=new Map();
   if(zip){
    for(const [path,entry] of Object.entries(zip.files)){
     if(entry.dir||(!path.startsWith('documents/')&&!path.startsWith('videos/')))continue;
     const parts=path.split('/');
     if(parts.length<3)continue;
     const folder=parts[0];
     const oldId=parts[1];
     const existingFile=await storeGet('files',oldId);
     const id=existingFile?crypto.randomUUID():oldId;
     const blob=await entry.async('blob');
     const filename=parts.slice(2).join('/');
     await saveFile(id,new File([blob],filename,{type:blob.type}),{
      name:filename,
      type:blob.type,
      size:blob.size,
      category:folder==='videos'?'book-video':'document'
     });
     fileMap.set(oldId,id);
     fileCount++;
    }
   }

   let restored=0,skipped=0;
   for(const r of parsed.records){
    const existing=r.id?await storeGet('records',r.id):null;
    if(existing?.user_id===user.id){skipped++;continue;}

    const payload=r.payload&&typeof r.payload==='object'?{...r.payload}:{};
    if(payload.local_file_id&&fileMap.has(payload.local_file_id)){
     payload.local_file_id=fileMap.get(payload.local_file_id);
    }
    if(payload.video_file_id&&fileMap.has(payload.video_file_id)){
     payload.video_file_id=fileMap.get(payload.video_file_id);
    }

    const row={
     id:existing?crypto.randomUUID():(r.id||crypto.randomUUID()),
     user_id:user.id,
     section:r.section,
     title:String(r.title||'Restored item'),
     payload,
     created_at:r.created_at||new Date().toISOString(),
     updated_at:new Date().toISOString(),
     _local:true,_sync_status:'pending'
    };
    await storePutAndQueue('records',row,{type:'upsert',user_id:user.id,row});
    restored++;
   }

   if(!String(user.id).startsWith('local-'))await syncPending(user.id);
   setMsg(`Restored ${restored} records and ${fileCount} document/video files. ${skipped} existing records were left unchanged.`);
   setRestoreFile(null);
  }catch(e){setMsg(`Restore failed: ${e.message}`);}
  finally{setBusy(false);}
 } return <div className="module"><div className="module-head"><div><h2>Settings</h2><p>Manage your account, appearance and local data safety.</p></div></div><article className="record-card setting-row"><div><h3>Workspace</h3><p>{user.email}</p></div></article><article className="record-card setting-row"><div><h3>Device storage</h3><p>{storage?.supported?`${formatBytes(storage.usage)} used of ${formatBytes(storage.quota)}${storage.percent!==null?` (${storage.percent}%)`:''}`:'Storage estimate is not supported by this browser.'}</p><p className="muted small">{storage?.persisted?'Persistent storage permission is granted.':'The browser may clear local data under storage pressure; keep external backups.'}</p></div><button className="secondary" onClick={async()=>{await requestPersistentStorage();setStorage(await getStorageInfo());}}>Check storage</button></article><article className="record-card setting-row"><div><h3>Appearance</h3><p>Switch between light and dark mode.</p></div><button className="secondary" onClick={()=>setDark(!dark)}>{dark?'Use light mode':'Use dark mode'}</button></article><article className="record-card setting-row"><div><h3>Export full backup</h3><p>Download records, documents and locally saved book videos in one ZIP.</p></div><button className="primary" disabled={busy} onClick={backup}>{busy?'Preparing...':'Download backup'}</button></article><article className="record-card setting-row"><div><h3>Restore backup</h3><p>Restore an ALI HUB ZIP backup or older JSON backup. Existing records are kept.</p><input type="file" accept="application/zip,.zip,application/json,.json" onChange={e=>setRestoreFile(e.target.files?.[0]||null)}/></div><button className="secondary" disabled={busy||!restoreFile} onClick={restore}>{busy?'Working...':'Restore backup'}</button></article>{msg&&<p className="notice">{msg}</p>}<p className="muted small">Important: browser storage is device-specific. Export backups regularly. Clearing browser data or uninstalling the browser can remove local files.</p></div>;
}







