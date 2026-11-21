import { useEffect, useState } from 'react';
import { Plus, Trash2, Play, CheckCircle, ArrowLeft } from 'lucide-react';
import { createRecord, listRecords, updateRecord, deleteRecord } from '../lib/records';

export default function Quizzes({ user }) {
  const [items,setItems] = useState([]);
  const [title,setTitle] = useState('');
  const [subject,setSubject] = useState('');
  const [date,setDate] = useState('');
  const [questions,setQuestions] = useState([{text:'',options:['','','',''],correct:0}]);
  const [busy,setBusy] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [mode,setMode] = useState('list');
  const [active,setActive] = useState(null);
  const [answers,setAnswers] = useState({});
  const [result,setResult] = useState(null);

  async function refresh(){
    setBusy(true);
    try { setItems(await listRecords(user.id,'quizzes')); }
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  }

  useEffect(()=>{refresh();},[user.id]);

  function addQuestion(){
    setQuestions([...questions,{text:'',options:['','','',''],correct:0}]);
  }

  function changeQuestion(i,key,value){
    setQuestions(old=>old.map((q,n)=>n===i?{...q,[key]:value}:q));
  }

  function changeOption(i,n,value){
    setQuestions(old=>old.map((q,k)=>k===i?{...q,options:q.options.map((o,j)=>j===n?value:o)}:q));
  }

  function resetForm(){
    setTitle('');
    setSubject('');
    setDate('');
    setQuestions([{text:'',options:['','','',''],correct:0}]);
  }

  async function saveQuiz(e){
    e.preventDefault();
    if(!title.trim()||!subject.trim())return;
    if(!questions.length||questions.some(q=>!q.text.trim()||q.options.some(o=>!o.trim()))){
      setError('Har question aur uske 4 options complete karo.');
      return;
    }
    setSaving(true);setError('');
    try{
      const payload={subject,date,status:'Ready',questions,attempts:[]};
      const row=await createRecord(user.id,'quizzes',title.trim(),payload);
      setItems(old=>[row,...old]);
      resetForm();
      setMode('list');
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  }

  async function removeQuiz(item){
    if(!confirm('Delete this quiz and its saved results?'))return;
    try{
      await deleteRecord(item.id);
      setItems(old=>old.filter(x=>x.id!==item.id));
    }catch(e){setError(e.message);}
  }

  function startQuiz(item){
    if(!item.payload?.questions?.length){
      setError('Ye purana quiz tracker record hai. Ismein questions available nahi hain.');
      return;
    }
    setActive(item);
    setAnswers({});
    setResult(null);
    setMode('attempt');
  }

  async function submitQuiz(){
    const qs=active.payload.questions;
    const score=qs.reduce((total,q,i)=>total+(Number(answers[i])===Number(q.correct)?1:0),0);
    const attempt={score,total:qs.length,percentage:Math.round(score/qs.length*100),date:new Date().toISOString()};
    const attempts=[...(active.payload.attempts||[]),attempt];
    setSaving(true);
    try{
      const row=await updateRecord(active.id,{payload:{...active.payload,attempts}});
      setItems(old=>old.map(x=>x.id===row.id?row:x));
      setActive(row);
      setResult(attempt);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  }

  if(mode==='create') return <div className="module">
    <div className="module-head"><div><h2>Create Quiz</h2><p>Apna MCQ quiz tayar karo.</p></div></div>
    <form className="form-card" onSubmit={saveQuiz}>
      <label>Quiz title<input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="e.g. Programming Fundamentals"/></label>
      <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} required/></label>
      <label>Quiz date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <h3>Questions</h3>
      {questions.map((q,i)=><div className="record-card" key={i}>
        <label>Question {i+1}<textarea rows="2" value={q.text} onChange={e=>changeQuestion(i,'text',e.target.value)} required/></label>
        {q.options.map((o,j)=><label key={j}>Option {j+1}<input value={o} onChange={e=>changeOption(i,j,e.target.value)} required/></label>)}
        <label>Correct answer
          <select value={q.correct} onChange={e=>changeQuestion(i,'correct',Number(e.target.value))}>
            {q.options.map((_,j)=><option value={j} key={j}>Option {j+1}</option>)}
          </select>
        </label>
        {questions.length>1&&<button type="button" className="secondary" onClick={()=>setQuestions(old=>old.filter((_,n)=>n!==i))}><Trash2 size={15}/> Remove question</button>}
      </div>)}
      <div className="form-actions">
        <button type="button" className="secondary" onClick={addQuestion}><Plus size={16}/> Add question</button>
        <button className="primary" disabled={saving}>{saving?'Saving...':'Save Quiz'}</button>
        <button type="button" className="secondary" onClick={()=>{resetForm();setMode('list');}}>Cancel</button>
      </div>
    </form>
    {error&&<p className="error">{error}</p>}
  </div>;

  if(mode==='attempt'&&active) return <div className="module">
    <div className="module-head"><div><h2>{active.title}</h2><p>{active.payload.subject} · {active.payload.questions.length} questions</p></div>
      <button className="secondary" onClick={()=>setMode('list')}><ArrowLeft size={16}/> Back</button>
    </div>
    {result ? <div className="record-card">
      <h2>Quiz Result</h2>
      <h1>{result.score} / {result.total}</h1>
      <h3>{result.percentage}%</h3>
      <p>{result.percentage>=80?'Excellent work!':result.percentage>=50?'Good effort! Keep practicing.':'Keep learning and try again!'}</p>
      <button className="primary" onClick={()=>setMode('list')}>Done</button>
    </div> : <>
      {active.payload.questions.map((q,i)=><div className="record-card" key={i}>
        <h3>{i+1}. {q.text}</h3>
        {q.options.map((o,j)=><label key={j} style={{display:'block',margin:'10px 0'}}>
          <input type="radio" name={'question-'+i} checked={Number(answers[i])===j} onChange={()=>setAnswers(old=>({...old,[i]:j}))}/> {o}
        </label>)}
      </div>)}
      <button className="primary" disabled={saving||Object.keys(answers).length!==active.payload.questions.length} onClick={submitQuiz}>{saving?'Submitting...':'Submit Quiz'}</button>
    </>}
    {error&&<p className="error">{error}</p>}
  </div>;

  return <div className="module">
    <div className="module-head">
      <div><h2>Quizzes</h2><p>Create MCQ quizzes, attempt them and track your scores.</p></div>
      <span className="count-pill">{items.length} saved</span>
    </div>
    <div className="form-actions">
      <button className="primary" onClick={()=>{setError('');setMode('create');}}><Plus size={17}/> Create Quiz</button>
    </div>
    {error&&<p className="error">{error}</p>}
    {busy?<p className="muted">Loading quizzes...</p>:<div className="record-grid">
      {items.map(item=><article className="record-card" key={item.id}>
        <h3>{item.title}</h3>
        <p><b>Subject:</b> {item.payload?.subject||'Not specified'}</p>
        {item.payload?.date&&<p><b>Date:</b> {item.payload.date}</p>}
        <p><b>Questions:</b> {item.payload?.questions?.length||0}</p>
        <p><b>Attempts:</b> {item.payload?.attempts?.length||0}</p>
        {item.payload?.attempts?.length>0&&<p><b>Best score:</b> {Math.max(...item.payload.attempts.map(a=>a.percentage))}%</p>}
        <div className="form-actions">
          <button className="primary" onClick={()=>startQuiz(item)}><Play size={16}/> Start Quiz</button>
          <button className="icon danger" onClick={()=>removeQuiz(item)} title="Delete"><Trash2 size={17}/></button>
        </div>
      </article>)}
      {!items.length&&<div className="empty">No quizzes yet. Create your first quiz.</div>}
    </div>}
  </div>;
}
