import { createBrowserRouter, Navigate, Outlet, RouterProvider, useNavigate, useRouteError, Link } from 'react-router-dom';
import { LogIn, Compass, ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './context';
import Layout from './components/Layout';
import { Button, Loading } from './components/ui';
import { Login, Register, Welcome } from './pages/Auth';
import StaffLayout from './components/StaffLayout';
import { StaffShifts, ShiftDetail, UniformTab, UniformGuide, Verify, StaffProfile, StaffNotifications, StaffSettings } from './pages/Staff';
import Dashboard from './pages/Dashboard';
import CreateEvent from './pages/CreateEvent';
import Marketplace from './pages/Marketplace';
import Roster from './pages/Roster';
import Review from './pages/Review';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { AuditQueue, DocumentReview, Reviewed } from './pages/Admin';

const home = (u) => (u.role === 'admin' ? '/admin/queue' : u.role === 'manager' ? '/dashboard' : '/staff/shifts');
const chosenLang = () => { try { return localStorage.getItem('ef_lang_chosen'); } catch { return '1'; } };

function Root() {
  const { user, expired } = useApp();
  return (
    <>
      <Outlet />
      {expired && user !== undefined && <SessionExpired />}
    </>
  );
}

function SessionExpired() {
  const { t, setExpired, setUser } = useApp();
  const nav = useNavigate();
  return (
    <div className="overlay" style={{ zIndex: 90 }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="se-t">
        <h2 id="se-t">{t('Your session has expired')}</h2>
        <p className="muted">{t('For your safety we log you out after 8 hours. Log in again to continue. Nothing you saved is lost.')}</p>
        <div className="actions">
          <Button autoFocus onClick={() => { setExpired(false); setUser(null); nav('/login'); }}><LogIn size={18} aria-hidden />{t('Log in again')}</Button>
        </div>
      </div>
    </div>
  );
}

function Guard({ roles }) {
  const { user } = useApp();
  if (user === undefined) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Denied />;
  return <Outlet />;
}
function PublicOnly() {
  const { user } = useApp();
  if (user === undefined) return <Loading />;
  if (user) return <Navigate to={home(user)} replace />;
  return <Outlet />;
}
function Start() {
  const { user } = useApp();
  if (user === undefined) return <Loading />;
  if (user) return <Navigate to={home(user)} replace />;
  return <Navigate to={chosenLang() ? '/login' : '/welcome'} replace />;
}

function Denied() {
  const { t, user } = useApp();
  return (
    <div className="state" style={{ minHeight: '60vh' }}>
      <div className="icon-circle red"><ShieldAlert size={32} aria-hidden /></div>
      <h2>{t('You don’t have access to this page')}</h2>
      <p className="muted">{t('This page is for another type of account.')}</p>
      <Link className="btn btn-secondary" to={home(user)}>{t('Go to my home page')}</Link>
    </div>
  );
}

function NotFound() {
  const { t } = useApp();
  return (
    <div className="state" style={{ minHeight: '70vh' }}>
      <div className="icon-circle"><Compass size={32} aria-hidden /></div>
      <h2>{t('Page not found')}</h2>
      <p className="muted">{t('The link may be old or mistyped.')}</p>
      <Link className="btn btn-primary" to="/">{t('Go home')}</Link>
    </div>
  );
}

function Crash() {
  const err = useRouteError();
  console.error(err);
  return (
    <div className="state" style={{ minHeight: '70vh' }} role="alert">
      <h2>Something went wrong on this page</h2>
      <p className="muted">Please reload. If it keeps happening, contact support@eventflow.pk.</p>
      <Button onClick={() => window.location.reload()}>Reload page</Button>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <Crash />,
    children: [
      { path: '/', element: <Start /> },
      { element: <PublicOnly />, children: [
        { path: '/welcome', element: <Welcome /> },
        { path: '/login', element: <Login /> },
        { path: '/register', element: <Register /> },
      ] },
      { element: <Guard roles={['staff']} />, children: [{
        element: <StaffLayout />,
        children: [
          { path: '/staff', element: <Navigate to="/staff/shifts" replace /> },
          { path: '/staff/shifts', element: <StaffShifts /> },
          { path: '/staff/shifts/:id', element: <ShiftDetail /> },
          { path: '/staff/uniform', element: <UniformTab /> },
          { path: '/staff/uniform/:id', element: <UniformGuide /> },
          { path: '/staff/verify', element: <Verify /> },
          { path: '/staff/profile', element: <StaffProfile /> },
          { path: '/staff/notifications', element: <StaffNotifications /> },
          { path: '/staff/settings', element: <StaffSettings /> },
        ],
      }] },
      // old links from notifications
      { path: '/shifts', element: <Navigate to="/staff/shifts" replace /> },
      { path: '/verify', element: <Navigate to="/staff/verify" replace /> },
      { path: '/profile', element: <Navigate to="/staff/profile" replace /> },
      { element: <Guard roles={['manager', 'admin']} />, children: [{
        element: <Layout />,
        children: [
          { path: '/settings', element: <Settings /> },
          { element: <Guard roles={['manager']} />, children: [
            { path: '/dashboard', element: <Dashboard /> },
            { path: '/events/new', element: <CreateEvent /> },
            { path: '/events/:id/roster', element: <Roster /> },
            { path: '/events/:id/review', element: <Review /> },
            { path: '/marketplace', element: <Marketplace /> },
            { path: '/analytics', element: <Analytics /> },
          ] },
          { element: <Guard roles={['admin']} />, children: [
            { path: '/admin/queue', element: <AuditQueue /> },
            { path: '/admin/documents/:id', element: <DocumentReview /> },
            { path: '/admin/reviewed', element: <Reviewed /> },
          ] },
          { path: '*', element: <NotFound /> },
        ],
      }] },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <AppProvider><RouterProvider router={router} /></AppProvider>;
}
