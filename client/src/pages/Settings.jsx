import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Mail, Phone, ShieldCheck, Info } from 'lucide-react';
import { useApp } from '../context';
import { Toggle } from '../components/ui';

function Section({ title, children }) {
  return (
    <section className="card card-pad" style={{ marginBottom: 16 }} aria-label={title}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>{children}
    </section>
  );
}

export default function Settings({ embedded }) {
  const { t, lang, user, textSize, contrast, saveSettings, toast } = useApp();
  const nav = useNavigate();
  const [size, setSize] = useState(textSize);
  const [open, setOpen] = useState(null);
  const save = async (s, msg) => {
    try { await saveSettings(s); if (msg) toast(msg, { kind: 'success', seconds: 3 }); }
    catch (e) { toast(e.message, { kind: 'error' }); }
  };
  return (
    <div style={{ maxWidth: 680 }}>
      {!embedded && <div className="page-head">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label={t('Back')}><ArrowLeft size={22} className="flip" /></button>
        <h1 style={{ fontSize: '1.75rem' }}>{t('Settings & Help')}</h1>
      </div>}

      <Section title={t('Language')}>
        <div className="seg" role="group" aria-label={t('Language')} style={{ width: 'min(100%, 360px)', display: 'flex' }}>
          <button style={{ flex: 1, fontFamily: 'var(--font-urdu)' }} lang="ur" aria-pressed={lang === 'ur'} onClick={() => save({ language: 'ur' }, 'زبان اردو کر دی گئی')}>اردو</button>
          <button style={{ flex: 1 }} className="latin" lang="en" aria-pressed={lang === 'en'} onClick={() => save({ language: 'en' }, 'Language set to English')}>English</button>
        </div>
      </Section>

      <Section title={t('Text size')}>
        <div className="row">
          <span className="small" aria-hidden>A</span>
          <input type="range" min={100} max={200} step={10} value={size} aria-label={t('Text size')} aria-valuetext={`${size}%`}
            onChange={(e) => setSize(Number(e.target.value))} onMouseUp={() => save({ textSize: size })} onKeyUp={() => save({ textSize: size })} onTouchEnd={() => save({ textSize: size })} />
          <span style={{ fontSize: '1.5rem' }} aria-hidden>A</span>
          <b className="num" style={{ minWidth: 56, textAlign: 'end' }}>{size}%</b>
        </div>
        <p className="small muted">{t('Makes all text bigger, up to 200%.')}</p>
      </Section>

      <Section title={t('Display')}>
        <div className="setting-row">
          <label htmlFor="hc"><b>{t('High contrast')}</b><div className="small muted">{t('Darker text and stronger borders.')}</div></label>
          <Toggle id="hc" checked={contrast} onChange={(v) => save({ highContrast: v })} label={t('High contrast')} />
        </div>
      </Section>

      <Section title={t('Notifications')}>
        <div className="setting-row">
          <label htmlFor="n1"><b>{t('Event reminders')}</b><div className="small muted">{t('Unfilled slots and conflicts before your events.')}</div></label>
          <Toggle id="n1" checked={user.settings.notifReminders} onChange={(v) => save({ notifReminders: v }, t('Saved'))} label={t('Event reminders')} />
        </div>
        <div className="setting-row">
          <label htmlFor="n2"><b>{t('Staff replies')}</b><div className="small muted">{t('When staff accept or decline your invites.')}</div></label>
          <Toggle id="n2" checked={user.settings.notifInvites} onChange={(v) => save({ notifInvites: v }, t('Saved'))} label={t('Staff replies')} />
        </div>
      </Section>

      <Section title={t('Help')}>
        {[
          ['support', Phone, t('Contact support'), <>{t('Call or WhatsApp')} <span className="latin" dir="ltr">0300-0000000</span>, {t('9 am to 9 pm')}. <span className="latin">support@eventflow.pk</span></>],
          ['privacy', ShieldCheck, t('Privacy'), t('CNIC images are only seen by our admin team. Managers only see the “Verified Pro” badge, never the card itself.')],
          ['about', Info, t('About'), <>EventFlow Pro · {t('Version')} 1.0 · {t('Phase 4 course project, CS3014 Applied HCI, FAST NUCES.')}</>],
        ].map(([k, Icon, label, body]) => (
          <div key={k} className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <button className="row" style={{ background: 'none', border: 0, cursor: 'pointer', padding: '4px 0', minHeight: 44 }} aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>
              <Icon size={20} aria-hidden color="var(--indigo-600)" /><span style={{ flex: 1, textAlign: 'start', fontWeight: 600 }}>{label}</span>
              <ChevronRight size={18} aria-hidden className="flip" style={{ transform: open === k ? 'rotate(90deg)' : undefined }} />
            </button>
            {open === k && <p className="small muted" style={{ paddingInlineStart: 32 }}>{body}</p>}
          </div>
        ))}
      </Section>
      <p className="small muted"><Mail size={14} aria-hidden style={{ verticalAlign: -2 }} /> {t('Signed in as {n} ({p})', { n: user.fullName, p: user.phone })}</p>
    </div>
  );
}
