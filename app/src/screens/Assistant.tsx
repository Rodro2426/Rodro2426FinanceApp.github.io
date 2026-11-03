import { useRef, useState } from 'react';
import { useApp, flash } from '../lib/store';
import { ink, tint } from '../lib/constants';
import { SUGGESTIONS, sendToAssistant } from '../lib/assistant';
import * as I from '../ui/icons';

export function AssistantChat() {
  const { data: d, ui } = useApp();
  const empty = ui.chat.length === 0 && !ui.thinking;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '4px 4px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Assistant</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Ask questions, plan budgets, or log expenses by voice</span>
      </div>

      {empty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'var(--color-accent-100)', borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, background: '#fff', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.Sparkle size={22} /></div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-900)', letterSpacing: '-0.01em' }}>Hi {d.settings.name}, how can I help?</span>
            <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--color-accent-800)', textWrap: 'pretty' }}>I can see your pockets, accounts and goals. Tap the mic and say something like "gasté 45 mil en el mercado" and I'll log it for you.</span>
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Try asking</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SUGGESTIONS.map(l => (
              <button key={l} onClick={() => sendToAssistant(l)} className="hv-n200" style={{ textAlign: 'left', padding: '13px 16px', borderRadius: 20, border: 0, background: '#fff', fontSize: 14, fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{l}</span>
                <I.Arrow size={16} color="var(--color-neutral-500)" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ui.chat.map((m, i) => {
          const u = m.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: u ? 'flex-end' : 'flex-start', gap: 6 }}>
              {m.voice && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-600)', padding: '0 6px' }}>
                  <I.Mic size={12} />Voice message
                </span>
              )}
              {m.text && <div style={{ maxWidth: '84%', padding: '11px 15px', borderRadius: u ? '22px 22px 6px 22px' : '22px 22px 22px 6px', background: u ? 'var(--color-accent)' : '#fff', color: u ? '#fff' : 'var(--color-text)', fontSize: 15, lineHeight: 1.4, whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>{m.text}</div>}
              {(m.cards || []).map((c, j) => (
                <div key={j} style={{ width: '84%', background: '#fff', borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 999, background: tint(c.hue), color: ink(c.hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flex: 'none' }}>{c.initial}</div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: ink(c.hue) }}>{c.kicker}</span>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{c.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{c.sub}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.amt}</span>
                </div>
              ))}
            </div>
          );
        })}
        {ui.thinking && (
          <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '22px 22px 22px 6px', background: '#fff', fontSize: 14, color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', gap: 4 }}>
              <span className="dot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--color-neutral-400)' }} />
              <span className="dot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--color-neutral-500)' }} />
              <span className="dot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--color-neutral-600)' }} />
            </span>
            Thinking
          </div>
        )}
      </div>
    </div>
  );
}

type SR = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void; onresult: (ev: any) => void; onerror: (ev: any) => void; onend: () => void };

/** Floating composer above the tab bar: text box, mic and send. */
export function AssistantComposer() {
  const { data: d, ui } = useApp();
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const rec = useRef<SR | null>(null);

  const send = (t: string, voice = false) => { if (!t.trim() || ui.thinking) return; setDraft(''); sendToAssistant(t, voice); };

  const toggleMic = () => {
    if (listening) { try { rec.current?.stop(); } catch { /* already stopped */ } return; }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { flash("Voice isn't supported in this browser. Type instead."); return; }
    const r: SR = new Ctor(); rec.current = r;
    r.lang = d.settings.voiceLang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let finalText = '', latest = '';
    r.onresult = ev => {
      let mid = ''; finalText = '';
      for (let i = 0; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) finalText += t; else mid += t; }
      latest = (finalText + ' ' + mid).trim(); setInterim(latest);
    };
    r.onerror = ev => { setListening(false); flash(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'Microphone access is blocked' : "I didn't catch that. Try again."); };
    r.onend = () => { const t = (finalText || latest).trim(); setListening(false); setInterim(''); if (t) send(t, true); };
    try { r.start(); setListening(true); setInterim(''); } catch { flash('Could not start the microphone'); }
  };

  const cant = !draft.trim() || ui.thinking;
  return (
    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(var(--tb) + 72px)', zIndex: 25, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {listening && (
        <div style={{ alignSelf: 'center', maxWidth: '100%', background: 'var(--color-text)', color: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', boxShadow: 'var(--shadow-md)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--color-accent)', flex: 'none', boxShadow: '0 0 0 4px color-mix(in srgb,var(--color-accent) 35%,transparent)' }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{interim || 'Listening… tap the mic to stop'}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 999, padding: '6px 6px 6px 18px', boxShadow: '0 8px 24px rgba(45,43,43,.12),0 0 0 1px rgba(45,43,43,.04)' }}>
        <input placeholder="Ask or tell me an expense…" value={listening ? interim : draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(draft); } }}
          style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, color: 'var(--color-text)', padding: 0, outline: 'none' }} />
        <button onClick={toggleMic} aria-label="Voice message" style={{ width: 42, height: 42, borderRadius: 999, border: 0, background: listening ? 'var(--color-accent)' : 'var(--color-accent-100)', color: listening ? '#fff' : 'var(--color-accent-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none', boxShadow: listening ? '0 0 0 6px color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'none', transition: 'all .2s' }}>
          <I.Mic size={19} />
        </button>
        <button onClick={() => send(draft)} disabled={cant} aria-label="Send" style={{ width: 42, height: 42, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none', opacity: cant ? 0.4 : 1, transition: 'opacity .2s' }}>
          <I.ArrowUp size={19} />
        </button>
      </div>
    </div>
  );
}
