import { useState } from 'react';
import { LogIn, UserPlus, LoaderCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
export default function Auth({ onUseOffline }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(data.session ? 'Account created. You are signed in.' : 'Account created. Check your email to confirm, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { setMessage(err.message || 'Authentication failed.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-wrap"><form className="auth-card" onSubmit={submit}><div className="brand-mark">A</div><p className="eyebrow">YOUR PERSONAL DIGITAL SPACE</p><h1>ALI HUB</h1><p className="muted">{mode === 'login' ? 'Sign in to your personal workspace.' : 'Create your personal workspace account.'}</p><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required autoComplete={mode==='login'?'current-password':'new-password'}/></label><button className="primary full" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : mode==='login' ? <LogIn size={17}/> : <UserPlus size={17}/>} {mode==='login'?'Sign in':'Create account'}</button>{message && <p className="notice">{message}</p>}<button type="button" className="text-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('');}}>{mode==='login'?"Don't have an account? Create one":"Already have an account? Sign in"}</button>{onUseOffline&&<button type="button" className="secondary full" onClick={onUseOffline}>Continue in offline mode</button>}</form></main>;
}