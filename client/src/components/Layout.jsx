import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Users, BarChart3, Settings, LogOut, Search, Bell, Inbox, History, WifiOff, Info, X, UserCircle2 } from 'lucide-react';
import { useApp } from '../context';
import { get, post, del } from '../api';
import { timeAgo, isToday } from '../format';

export function LangToggle() {
  const { lang, setLang, t } = useApp();
  return (
    <div className="lang-toggle" role="group" aria-label={t('Language')}>
      <button className="ur" lang="ur" aria-pressed={lang === 'ur'} onClick={() => setLang('ur')}>اردو</button>
      <button className="latin" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}

export function Brand() {
  return (
    <a className="brand latin" href="/">
      <img src="/logo.svg" alt="" />EventFlow <span className="pro-tag">Pro</span>
    </a>
  );
}

function Sidebar() {
  const { user, t, logout, confirm } = useApp();
  const nav = useNavigate();
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    if (user?.role === 'admin') get('/admin/queue').then((d) => setQueue(d.pending)).catch(() => {});
  }, [user]);
  const doLogout = async () => {
    if (await confirm({ title: t('Log out?'), body: t('You will need your phone number, password and a code to log in again.'), ok: t('Log out') })) {
      await logout(); nav('/login');
    }
  };
  const loc = useLocation();
  const dashActive = loc.pathname.startsWith('/dashboard') || loc.pathname.startsWith('/events');
  return (
    <aside className="sidebar" aria-label={t('Main menu')}>
      <Brand />
      <nav className="nav">
        {user.role === 'manager' ? (
          <>
            <NavLink to="/dashboard" className={() => (dashActive && !loc.pathname.endsWith('/review') ? 'active' : '')}><LayoutGrid size={22} aria-hidden />{t('Dashboard')}</NavLink>
            <NavLink to="/marketplace"><Users size={22} aria-hidden />{t('Talent Marketplace')}</NavLink>
            <NavLink to="/analytics" className={({ isActive }) => (isActive || loc.pathname.endsWith('/review') ? 'active' : '')}><BarChart3 size={22} aria-hidden />{t('Analytics')}</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/admin/queue" className={() => (loc.pathname.startsWith('/admin/queue') || loc.pathname.startsWith('/admin/documents') ? 'active' : '')}>
              <Inbox size={22} aria-hidden />{t('Audit Queue')}{queue ? <span className="count">{queue}</span> : null}
            </NavLink>
            <NavLink to="/admin/reviewed"><History size={22} aria-hidden />{t('Reviewed')}</NavLink>
          </>
        )}
      </nav>
      <nav className="nav nav-bottom" aria-label={t('Account')}>
        <NavLink to="/settings"><Settings size={22} aria-hidden />{t('Settings & Help')}</NavLink>
        <button onClick={doLogout}><LogOut size={22} className="flip" aria-hidden />{t('Log out')}</button>
      </nav>
    </aside>
  );
}

function NotificationsPanel({ onClose }) {
  const { t, setUnread } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('all');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => get('/notifications').then((d) => { setData(d); setUnread(d.unread); setErr(null); }).catch(setErr);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const items = (data?.items || []).filter((n) => tab === 'all' || !n.is_read);
  const today = items.filter((n) => isToday(n.created_at));
  const older = items.filter((n) => !isToday(n.created_at));
  const open = async (n) => {
    if (!n.is_read) await post(`/notifications/${n.id}/read`).catch(() => {});
    onClose(); if (n.link) nav(n.link);
  };
  const remove = async (n) => { await del(`/notifications/${n.id}`).catch(() => {}); load(); };
  const readAll = async () => { await post('/notifications/read-all'); load(); };
  const group = (label, list) => list.length > 0 && (
    <div>
      <div className="tiny muted" style={{ padding: '10px 16px 4px', fontWeight: 600, letterSpacing: '.04em' }}>{label}</div>
      {list.map((n) => (
        <div key={n.id} className={`notif ${n.is_read ? '' : 'unread'}`}>
          {n.is_read ? <Info size={20} color="var(--indigo-600)" aria-hidden style={{ marginTop: 2 }} /> : <span className="dot" aria-label={t('Unread')} />}
          <button onClick={() => open(n)} style={{ flex: 1, background: 'none', border: 0, textAlign: 'start', cursor: 'pointer', padding: 0 }}>
            <div style={{ fontWeight: 600 }}>{n.title}</div>
            <div className="small muted">{n.body}</div>
            <div className="tiny muted">{timeAgo(n.created_at, t)}</div>
          </button>
          <button className="icon-btn" onClick={() => remove(n)} aria-label={t('Dismiss')}><X size={18} /></button>
        </div>
      ))}
    </div>
  );
  return (
    <div className="popover" role="dialog" aria-label={t('Notifications')}>
      <div className="row" style={{ padding: '16px 16px 0' }}>
        <h3 style={{ flex: 1 }}>{t('Notifications')}</h3>
        <button className="btn btn-text btn-sm" onClick={readAll} disabled={!data?.unread}>{t('Mark all as read')}</button>
      </div>
      <div className="tabs" role="tablist" style={{ padding: '0 16px', marginBottom: 0 }}>
        <button role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>{t('All')}</button>
        <button role="tab" aria-selected={tab === 'unread'} onClick={() => setTab('unread')}>{t('Unread')} {data?.unread ? `(${data.unread})` : ''}</button>
      </div>
      {err && <p className="field-error" style={{ padding: 16 }}>{err.message}</p>}
      {!data && !err && <div className="skeleton" style={{ height: 160, margin: 16 }} />}
      {data && items.length === 0 && (
        <div className="state"><div className="icon-circle"><Bell size={28} aria-hidden /></div><h3>{tab === 'unread' ? t('You are all caught up') : t('No notifications yet')}</h3>
          <p className="muted small">{t('Hires, confirmations and conflicts will show up here.')}</p></div>
      )}
      {group(t('TODAY'), today)}
      {group(t('EARLIER'), older)}
    </div>
  );
}

function Topbar() {
  const { t, unread, user } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [panel, setPanel] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setPanel(null); };
    const esc = (e) => e.key === 'Escape' && setPanel(null);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);
  const submit = (e) => {
    e.preventDefault();
    if (user.role === 'manager') nav(`/marketplace?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <header className="topbar" ref={ref}>
      {user.role === 'manager' ? (
        <form className="search" role="search" onSubmit={submit}>
          <Search size={18} aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search staff by name or role')} aria-label={t('Search staff by name or role')} />
        </form>
      ) : <span className="muted">{t('Admin console')}</span>}
      <span className="spacer" />
      <LangToggle />
      <button className="icon-btn" aria-label={t('Notifications, {n} unread', { n: unread })} aria-expanded={panel === 'n'} onClick={() => setPanel(panel === 'n' ? null : 'n')}>
        <Bell size={22} />
        {unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>
      <button className="avatar-btn" aria-label={t('Account menu')} aria-expanded={panel === 'u'} onClick={() => setPanel(panel === 'u' ? null : 'u')}>
        {user.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </button>
      {panel === 'n' && <NotificationsPanel onClose={() => setPanel(null)} />}
      {panel === 'u' && (
        <div className="menu" role="menu">
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontWeight: 600 }}>{user.fullName}</div>
            <div className="small muted">{user.company}</div>
          </div>
          <button role="menuitem" onClick={() => { setPanel(null); nav('/settings'); }}><UserCircle2 size={18} aria-hidden />{t('Settings & Help')}</button>
        </div>
      )}
    </header>
  );
}

export default function Layout() {
  const { online, t } = useApp();
  return (
    <div className="shell">
      <a href="#main" className="sr-only">{t('Skip to content')}</a>
      <Sidebar />
      <div className="main">
        <Topbar />
        {!online && (
          <div className="offline-bar" role="status"><WifiOff size={18} aria-hidden />
            <span><b>{t('No internet.')}</b> {t('You can look around, but changes will not save until you are back online.')}</span>
          </div>
        )}
        <main id="main" className="content"><Outlet /></main>
      </div>
    </div>
  );
}
