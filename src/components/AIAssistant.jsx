import { useState } from 'react';
import { Bot, Send, LoaderCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { listRecords } from '../lib/records';

async function localWorkspaceAnswer(userId, question) {
  const sections = ['knowledge', 'books', 'assignments', 'tasks', 'projects', 'documents'];
  const groups = await Promise.all(sections.map(section => listRecords(userId, section)));
  const saved = groups.flat();
  const terms = question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2);

  const matches = saved.map(record => {
    const text = `${record.title || ''} ${JSON.stringify(record.payload || {}).slice(0, 30000)}`;
    const lower = text.toLowerCase();
    return { record, text, score: terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0) };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

  if (!matches.length) return 'No matching records found in your offline workspace.';

  return matches.map(({ record, text }, i) =>
    `${i + 1}. ${record.title} (${record.section})\n${String(record.payload?.content || record.payload?.notes || record.payload?.extracted_text || text).slice(0, 900)}`
  ).join('\n\n');
}

async function getActualError(error) {
  let message = error?.message || 'Unknown AI request error';
  if (error?.context) {
    try {
      const body = await error.context.clone().text();
      if (body) message += ` | Server response: ${body.slice(0, 1500)}`;
    } catch {}
  }
  return message;
}

export default function AIAssistant({ user }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hello! I am your ALI HUB study and productivity assistant. Ask me anything.' }]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e) {
    e.preventDefault();
    const question = prompt.trim();
    if (!question || busy) return;

    setPrompt('');
    setError('');
    setMessages(m => [...m, { role: 'user', content: question }]);
    setBusy(true);

    try {
      if (!supabase) throw new Error('Supabase is not configured.');

      if (!navigator.onLine) {
        const reply = await localWorkspaceAnswer(user.id, question);
        setMessages(m => [...m, { role: 'assistant', content: `Offline workspace search:\n\n${reply}` }]);
        return;
      }

      const { data, error: invokeError } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: question,
          history: messages.slice(-8).map(({ role, content }) => ({ role, content }))
        }
      });

      if (invokeError) throw invokeError;
      if (!data?.reply) throw new Error(data?.error || `AI returned no reply: ${JSON.stringify(data)}`);

      setMessages(m => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(`ONLINE AI ERROR: ${await getActualError(err)}`);
      setPrompt(question);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="module">
      <div className="module-head">
        <div>
          <h2><Bot size={22} /> AI Assistant</h2>
          <p>Gemini online; local workspace search available offline.</p>
        </div>
        <span className="count-pill"><Sparkles size={14} /> Gemini powered</span>
      </div>
      <div className="ai-chat" aria-live="polite">
        {messages.map((m, i) => (
          <div className={`chat-bubble ${m.role}`} key={i}>
            <b>{m.role === 'user' ? 'You' : 'ALI HUB AI'}</b>
            <p>{m.content}</p>
          </div>
        ))}
        {busy && <div className="chat-bubble assistant"><LoaderCircle className="spin" /> Thinking...</div>}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="ai-compose" onSubmit={send}>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask anything about your studies or projects..." rows="2" />
        <button className="primary" disabled={busy || !prompt.trim()}><Send size={17} /> Send</button>
      </form>
      <p className="muted small">AI responses can be inaccurate. Verify important academic or technical information.</p>
    </div>
  );
}
