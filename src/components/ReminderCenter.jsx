import { useEffect, useState } from 'react';
import { BellRing, CalendarClock } from 'lucide-react';
import { listRecords } from '../lib/records';

function getDue(item){const p=item.payload||{};if(p.event_date&&p.event_time){const timed=new Date(`${p.event_date}T${p.event_time}`);if(!Number.isNaN(timed.getTime()))return timed;}const raw=p.due_date||p.deadline||p.event_date||p.date;if(!raw)return null;const value=String(raw);const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T23:59:00`:value);return Number.isNaN(d.getTime())?null:d;}
export default function ReminderCenter({user}){
 const [upcoming,setUpcoming]=useState([]),[permission,setPermission]=useState(typeof window!=='undefined'&&'Notification'in window?Notification.permission:'unsupported');
 useEffect(()=>{
  let active=true;let timer;
  const refresh=async()=>{
   const sections=['tasks','events','assignments','quizzes'];
   let data=[];try{for(const section of sections)data.push(...await listRecords(user.id,section));}catch{return;}
   if(!active)return;
   const now=new Date(),end=new Date(now.getTime()+24*60*60*1000);
   const list=data.map(x=>({...x,due:getDue(x)})).filter(x=>x.due&&x.due>=now&&x.due<=end).sort((a,b)=>a.due-b.due);setUpcoming(list);
   if(typeof window!=='undefined'&&'Notification'in window&&Notification.permission==='granted'){
    const key=`ali-hub-reminded-${user.id}-${now.toISOString().slice(0,10)}`;let sent=[];try{sent=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
    const sentSet=new Set(sent);
    for(const item of list){const minutes=(item.due-now)/60000;if(minutes>=0&&minutes<=15&&!sentSet.has(item.id)){new Notification(`ALI HUB: ${item.title}`,{body:`${item.section} is due ${item.due.toLocaleString()}`});sentSet.add(item.id);}}
    try{localStorage.setItem(key,JSON.stringify([...sentSet]));}catch{/* Notifications should never interrupt reminder rendering. */}
   }
  };
  refresh();timer=window.setInterval(refresh,5*60*1000);return()=>{active=false;window.clearInterval(timer);};
 },[user.id]);
 async function enable(){if(typeof window==='undefined'||!('Notification'in window))return;const p=await Notification.requestPermission();setPermission(p);}
 if(!upcoming.length&&permission!=='default')return null;
 return <div className="reminder-panel"><div className="reminder-heading"><BellRing size={18}/><b>Reminders</b><span>{upcoming.length}</span></div>{upcoming.length?upcoming.slice(0,5).map(x=><div className="reminder-item" key={x.id}><CalendarClock size={16}/><span><b>{x.title}</b><small>{x.section} · {x.due.toLocaleString()}</small></span></div>):<p className="muted small">No items due in the next 24 hours.</p>}{permission==='default'&&<button className="secondary small-button" onClick={enable}>Enable browser notifications</button>}{permission==='denied'&&<small>Browser notifications are blocked. Upcoming reminders remain visible here.</small>}{permission==='unsupported'&&<small>Browser notifications are not supported in this browser.</small>}</div>;
}
