import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, ShieldCheck, Shirt, User, Bell, ArrowLeft, WifiOff, Smartphone, BadgeCheck } from 'lucide-react';
import { useApp } from '../context';
import { LangToggle } from './Layout';

// Top bar used by every staff screen (Phase 3 "Top Bar / Mobile")
export function MTop({ title, back }) {
  const { t, unread } = useApp();
  const nav = useNavigate();
  return (
    <header className="m-top">
      {back && <button className="icon-btn" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label={t('Back')}><ArrowLeft size={22} className="flip" /></button>}
      <h1 className="m-title">{title}</h1>
      <LangToggle />
      <button className="icon-btn" onClick={() => nav('/staff/notifications')} aria-label={t('Notifications, {n} unread', { n: unread })}>
        <Bell size={22} />{unread > 0 && <span className="bell-badge">{unread}</span>}
      </button>
    </header>
  );
}

export default function StaffLayout() {
  const { t, online } = useApp();
  useEffect(() => { document.body.dataset.shell = 'mobile'; return () => { delete document.body.dataset.shell; }; }, []);
  const tabs = [
    ['/staff/shifts', CalendarDays, t('Shifts')],
    ['/staff/verify', ShieldCheck, t('Verify')],
    ['/staff/uniform', Shirt, t('Uniform')],
    ['/staff/profile', User, t('Profile')],
  ];
  return (
    <div className="m-page">
      {/* Only visible on wide screens, so desktop users don't see empty space */}
      <aside className="m-aside" aria-hidden="true">
        <div className="brand latin" style={{ padding: 0 }}><img src="/logo.svg" alt="" />EventFlow <span className="pro-tag">Pro</span></div>
        <h2>{t('The staff app')}</h2>
        <p>{t('Find shifts, get verified and check your uniform. It is made for phones: on your phone it fills the whole screen.')}</p>
        <div className="m-aside-point"><Smartphone size={20} /><span>{t('Open this same link on your phone and add it to your home screen.')}</span></div>
        <div className="m-aside-point"><BadgeCheck size={20} /><span>{t('Verified Pro staff are hired first.')}</span></div>
        <div className="m-aside-point"><Shirt size={20} /><span>{t('Your shifts and uniform guide still open without internet.')}</span></div>
      </aside>
      <div className="m-app">
        <a href="#m-main" className="sr-only">{t('Skip to content')}</a>
        {!online && <div className="offline-bar" role="status" style={{ padding: '8px 16px' }}><WifiOff size={16} aria-hidden />{t('Offline – showing saved data')}</div>}
        <main id="m-main" className="m-body"><Outlet /></main>
        <nav className="m-tabs" aria-label={t('Main menu')}>
          {tabs.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} className="m-tab">
              <span className="m-tab-ic"><Icon size={22} aria-hidden /></span>{label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
