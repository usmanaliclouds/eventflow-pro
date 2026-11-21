import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { get, patch, post, onSessionExpired } from './api';
import { UR } from './i18n-ur';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const readLocal = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const writeLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [lang, setLangState] = useState(readLocal('ef_lang', 'en'));
  const [textSize, setTextSize] = useState(100);
  const [contrast, setContrast] = useState(false);
  const [expired, setExpired] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [unread, setUnread] = useState(0);

  // apply language, text size and contrast to the whole page
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    writeLocal('ef_lang', lang);
  }, [lang]);
  useEffect(() => { document.documentElement.style.setProperty('--scale', String(textSize / 100)); }, [textSize]);
  useEffect(() => { document.documentElement.dataset.contrast = contrast ? 'high' : 'normal'; }, [contrast]);

  const applyUser = useCallback((u) => {
    setUser(u);
    if (u) { setLangState(u.settings.language); setTextSize(u.settings.textSize); setContrast(u.settings.highContrast); }
  }, []);

  useEffect(() => {
    get('/auth/me').then((d) => applyUser(d.user)).catch(() => setUser(null));
    const off = onSessionExpired(() => setExpired(true));
    const on = () => setOnline(true); const offl = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', offl);
    return () => { off(); window.removeEventListener('online', on); window.removeEventListener('offline', offl); };
  }, [applyUser]);

  const refreshUnread = useCallback(() => {
    if (!user) return;
    get('/notifications').then((d) => setUnread(d.unread)).catch(() => {});
  }, [user]);
  useEffect(() => { refreshUnread(); const id = setInterval(refreshUnread, 30000); return () => clearInterval(id); }, [refreshUnread]);

  const saveSettings = useCallback(async (s) => {
    if (s.language) setLangState(s.language);
    if (s.textSize) setTextSize(s.textSize);
    if (s.highContrast !== undefined) setContrast(s.highContrast);
    if (user) { const d = await patch('/me/settings', s); setUser(d.user); }
  }, [user]);
  const setLang = useCallback((l) => saveSettings({ language: l }).catch(() => {}), [saveSettings]);

  const t = useCallback((s, vars) => {
    let out = lang === 'ur' && UR[s] ? UR[s] : s;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
    return out;
  }, [lang]);

  // ---- toasts (Golden Rule 3: informative feedback) ----
  const timers = useRef({});
  const dismiss = useCallback((id) => { setToasts((ts) => ts.filter((x) => x.id !== id)); clearInterval(timers.current[id]); }, []);
  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const seconds = opts.seconds ?? (opts.onUndo ? 10 : 5);
    setToasts((ts) => [...ts.slice(-2), { id, message, kind: opts.kind || 'info', onUndo: opts.onUndo, left: seconds }]);
    timers.current[id] = setInterval(() => {
      setToasts((ts) => ts.map((x) => (x.id === id ? { ...x, left: x.left - 1 } : x)).filter((x) => x.id !== id || x.left > 0));
    }, 1000);
    setTimeout(() => clearInterval(timers.current[id]), seconds * 1000 + 100);
    return id;
  }, []);

  // ---- confirm dialog (Golden Rule 4 + 6) ----
  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user, setUser: applyUser, lang, setLang, t, textSize, contrast, saveSettings, toast, confirm, logout,
    online, unread, setUnread, refreshUnread, expired, setExpired,
  }), [user, applyUser, lang, setLang, t, textSize, contrast, saveSettings, toast, confirm, logout, online, unread, refreshUnread, expired]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.kind}`}>
            {x.kind === 'success' ? <CheckCircle2 size={20} aria-hidden /> : x.kind === 'error' ? <AlertCircle size={20} aria-hidden /> : <Info size={20} aria-hidden />}
            <span style={{ flex: 1 }}>{x.message}</span>
            {x.onUndo && (
              <button className="undo" onClick={() => { dismiss(x.id); x.onUndo(); }}>
                {t('Undo')} ({x.left})
              </button>
            )}
            <button className="icon-btn" style={{ color: '#fff', width: 36, height: 36 }} onClick={() => dismiss(x.id)} aria-label={t('Close')}>
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
      {dialog && <ConfirmDialog d={dialog} t={t} close={(v) => { dialog.resolve(v); setDialog(null); }} />}
    </AppCtx.Provider>
  );
}

function ConfirmDialog({ d, close, t }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <h2 id="dlg-title" style={{ flex: 1 }}>{d.title}</h2>
          <button className="icon-btn" onClick={() => close(false)} aria-label={t('Close')}><X size={20} /></button>
        </div>
        <p id="dlg-body" className="muted">{d.body}</p>
        <div className="actions">
          <button className="btn btn-secondary" ref={ref} onClick={() => close(false)}>{d.cancel || t('Cancel')}</button>
          <button className={`btn ${d.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>{d.ok || t('Confirm')}</button>
        </div>
      </div>
    </div>
  );
}
