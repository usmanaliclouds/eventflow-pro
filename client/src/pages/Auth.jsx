import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BadgeCheck, Wallet, Shirt, Briefcase, HardHat, ArrowLeft, ArrowRight, Info, Lock, Smartphone } from 'lucide-react';
import { useApp } from '../context';
import { post } from '../api';
import { Button, Field, PasswordInput } from '../components/ui';
import { Brand, LangToggle } from '../components/Layout';

const homeFor = (role) => (role === 'admin' ? '/admin/queue' : role === 'manager' ? '/dashboard' : '/staff/shifts');

function AuthFrame({ children }) {
  const { t } = useApp();
  return (
    <div className="auth">
      <section className="auth-side" aria-label="EventFlow Pro">
        <Brand />
        <h1>{t('Hire verified event staff in minutes.')}</h1>
        <div className="point"><BadgeCheck size={22} aria-hidden /><span>{t('Every Verified Pro worker has a checked CNIC and certificates.')}</span></div>
        <div className="point"><Wallet size={22} aria-hidden /><span>{t('See your labour budget change with every hire and drop.')}</span></div>
        <div className="point"><Shirt size={22} aria-hidden /><span>{t('Staff see the right uniform for every shift, even offline.')}</span></div>
        <svg viewBox="0 0 400 200" style={{ position: 'absolute', bottom: -30, insetInlineEnd: -40, width: 420, opacity: 0.12 }} aria-hidden>
          <circle cx="300" cy="120" r="110" fill="none" stroke="#fff" strokeWidth="24" /><circle cx="300" cy="120" r="40" fill="#E99A1C" />
        </svg>
      </section>
      <section className="auth-main">
        <div style={{ position: 'absolute', top: 20, insetInlineEnd: 24 }}><LangToggle /></div>
        <div className="auth-card">{children}</div>
      </section>
    </div>
  );
}

// ---------- S1 Splash & Language ----------
export function Welcome() {
  const { t, lang, setLang } = useApp();
  const nav = useNavigate();
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 24 }}>
        <div>
          <h2>{t('Choose your language')}</h2>
          <p className="muted" lang="ur" style={{ fontFamily: 'var(--font-urdu)' }}>اپنی زبان منتخب کریں</p>
        </div>
        <div className="stack" style={{ gap: 12 }} role="radiogroup" aria-label={t('Language')}>
          {[['ur', 'اردو', 'Urdu'], ['en', 'English', 'انگریزی']].map(([code, label, sub]) => (
            <button key={code} className="role-card" role="radio" aria-checked={lang === code} aria-pressed={lang === code} onClick={() => setLang(code)}>
              <span className="ic" style={{ fontFamily: code === 'ur' ? 'var(--font-urdu)' : 'var(--font)', fontWeight: 700 }}>{code === 'ur' ? 'ا' : 'A'}</span>
              <span><span style={{ fontWeight: 700, fontSize: '1.125rem', display: 'block', fontFamily: code === 'ur' ? 'var(--font-urdu)' : 'var(--font)' }}>{label}</span>
                <span className="muted small">{sub}</span></span>
            </button>
          ))}
        </div>
        <p className="small muted">{t('You can change this any time from the top bar or Settings.')}</p>
        <Button onClick={() => { try { localStorage.setItem('ef_lang_chosen', '1'); } catch { /* */ } nav('/login'); }} block>
          {t('Continue')}<ArrowRight size={18} className="flip" aria-hidden />
        </Button>
      </div>
    </AuthFrame>
  );
}

// ---------- OTP step (part of S4) ----------
function OtpStep({ challenge, setChallenge, onBack }) {
  const { t, setUser } = useApp();
  const nav = useNavigate();
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(challenge.resendInSeconds);
  const refs = useRef([]);
  useEffect(() => { refs.current[0]?.focus(); }, [challenge.challengeId]);
  useEffect(() => { if (wait <= 0) return undefined; const id = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(id); }, [wait]);

  const submit = async (code) => {
    setLoading(true); setError('');
    try {
      const d = await post('/auth/verify-otp', { challengeId: challenge.challengeId, code });
      setUser(d.user);
      nav(homeFor(d.user.role), { replace: true });
    } catch (e) {
      setError(e.message);
      if (e.code === 'LOCKED' || e.code === 'OTP_GONE') setLocked(true);
      setDigits(Array(6).fill('')); refs.current[0]?.focus();
    } finally { setLoading(false); }
  };
  const setAt = (i, v) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) { // pasted the whole code
      const next = clean.slice(0, 6).split('');
      const full = [...next, ...Array(6 - next.length).fill('')];
      setDigits(full);
      if (next.length === 6) submit(next.join('')); else refs.current[next.length]?.focus();
      return;
    }
    const next = [...digits]; next[i] = clean; setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(''));
  };
  const resend = async () => {
    try { const c = await post('/auth/resend-otp', { challengeId: challenge.challengeId }); setChallenge(c); setWait(c.resendInSeconds); setError(''); setLocked(false); }
    catch (e) { setError(e.message); }
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <button className="btn btn-text" onClick={onBack} style={{ alignSelf: 'flex-start' }}><ArrowLeft size={18} className="flip" aria-hidden />{t('Back')}</button>
      <div>
        <h2>{t('Enter the code')}</h2>
        <p className="muted">{t('We sent a 6-digit code to')} <span className="latin" dir="ltr">{challenge.maskedPhone}</span></p>
      </div>
      {challenge.demoCode && (
        <div className="banner banner-info" style={{ margin: 0 }}>
          <Info size={20} color="var(--indigo-600)" aria-hidden />
          <span className="small">{t('Demo mode: no SMS is sent. Your code is')} <b className="latin" style={{ letterSpacing: 2 }}>{challenge.demoCode}</b></span>
        </div>
      )}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={locked || loading}>
        <legend className="sr-only">{t('6-digit code')}</legend>
        <div className={`otp ${error ? 'error' : ''}`}>
          {digits.map((d, i) => (
            <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={t('Digit {n} of 6', { n: i + 1 })} maxLength={6}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }} />
          ))}
        </div>
      </fieldset>
      {error && <p className="field-error" role="alert">{locked ? <Lock size={16} aria-hidden /> : null}{error}</p>}
      {loading && <p className="muted small" role="status">{t('Checking code…')}</p>}
      <div className="small">
        {wait > 0 ? <span className="muted">{t('Resend code in 0:{s}', { s: String(wait).padStart(2, '0') })}</span>
          : <button className="btn btn-text btn-sm" onClick={resend}>{t('Resend code')}</button>}
      </div>
    </div>
  );
}

// ---------- S4 Login ----------
export function Login() {
  const { t } = useApp();
  const loc = useLocation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(loc.state?.message || '');
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);

  const validatePhone = (v) => (/^03\d{9}$/.test(v) ? '' : t('Enter an 11-digit mobile number, e.g. 03001234567.'));
  const submit = async (e) => {
    e.preventDefault();
    const errs = { phone: validatePhone(phone), password: password ? '' : t('Enter your password.') };
    setErrors(errs); setBanner('');
    if (errs.phone || errs.password) return;
    setLoading(true);
    try { setChallenge(await post('/auth/login', { phone, password })); }
    catch (err) {
      if (err.body.fields) setErrors(err.body.fields);
      else setBanner(err.message);
    } finally { setLoading(false); }
  };
  if (challenge) return <AuthFrame><OtpStep challenge={challenge} setChallenge={setChallenge} onBack={() => setChallenge(null)} /></AuthFrame>;
  return (
    <AuthFrame>
      <form className="stack" style={{ gap: 20 }} onSubmit={submit} noValidate>
        <div>
          <h2>{t('Log in')}</h2>
          <p className="muted">{t('For event managers, field staff and admins.')}</p>
        </div>
        {banner && <div className="banner banner-error" role="alert" style={{ margin: 0 }}><Lock size={18} aria-hidden />{banner}</div>}
        <Field label={t('Mobile number')} error={errors.phone} hint={t('11 digits, starts with 03')}>
          {(a) => <input className="input latin" dir="ltr" {...a} inputMode="numeric" autoComplete="tel" placeholder="03001234567" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} onBlur={() => phone && setErrors((x) => ({ ...x, phone: validatePhone(phone) }))} />}
        </Field>
        <Field label={t('Password')} error={errors.password}>
          {(a) => <PasswordInput {...a} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" loading={loading} block>{t('Log in')}</Button>
        <button type="button" className="btn btn-text" onClick={() => setBanner(t('Password reset is not available in this version. Contact support: support@eventflow.pk'))}>{t('Forgot password?')}</button>
        <p className="muted" style={{ textAlign: 'center' }}>{t('New to EventFlow Pro?')} <Link to="/register">{t('Create account')}</Link></p>
        <details className="small muted">
          <summary style={{ cursor: 'pointer' }}>{t('Test accounts')}</summary>
          <p className="latin" dir="ltr">Manager: 03001234567 / Manager@123<br />Admin: 03111234567 / Admin@123</p>
        </details>
      </form>
    </AuthFrame>
  );
}

// ---------- S3 Registration ----------
export function Register() {
  const { t, lang } = useApp();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ fullName: '', phone: '', password: '', company: '', primaryRole: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value });

  const validate = () => {
    const e = {};
    if (role === 'staff' && !form.primaryRole) e.primaryRole = t('Choose the work you do.');
    if (form.fullName.trim().length < 3) e.fullName = t('Enter your full name (at least 3 letters).');
    if (!/^03\d{9}$/.test(form.phone)) e.phone = t('Enter an 11-digit mobile number, e.g. 03001234567.');
    if (form.password.length < 8) e.password = t('Password must be at least 8 characters.');
    else if (!/\d/.test(form.password)) e.password = t('Password must include at least one number.');
    return e;
  };
  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate(); setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try { const { primaryRole, company, ...rest } = form; setChallenge(await post('/auth/register', { role, ...rest, language: lang, ...(role === 'staff' ? { primaryRole } : { company: company || undefined }) })); }
    catch (err) { setErrors(err.body.fields || { _: err.message }); }
    finally { setLoading(false); }
  };

  if (challenge) return <AuthFrame><OtpStep challenge={challenge} setChallenge={setChallenge} onBack={() => setChallenge(null)} /></AuthFrame>;
  return (
    <AuthFrame>
      {step === 0 ? (
        <div className="stack" style={{ gap: 20 }}>
          <div>
            <p className="small muted">{t('Create account')} · {t('Step {a} of {b}', { a: 1, b: 2 })}</p>
            <h2>{t('I am…')}</h2>
          </div>
          <div className="stack" style={{ gap: 12 }} role="radiogroup" aria-label={t('Choose role')}>
            <button className="role-card" role="radio" aria-checked={role === 'manager'} aria-pressed={role === 'manager'} onClick={() => setRole('manager')}>
              <span className="ic"><Briefcase size={24} aria-hidden /></span>
              <span><b style={{ display: 'block' }}>{t('Event Manager')}</b><span className="muted small">{t('I hire staff for events')}</span></span>
            </button>
            <button className="role-card" role="radio" aria-checked={role === 'staff'} aria-pressed={role === 'staff'} onClick={() => setRole('staff')}>
              <span className="ic"><HardHat size={24} aria-hidden /></span>
              <span><b style={{ display: 'block' }}>{t('Field Staff')}</b><span className="muted small">{t('I work at events')}</span></span>
            </button>
          </div>
          <Button onClick={() => setStep(1)} disabled={!role} block>{t('Next')}<ArrowRight size={18} className="flip" aria-hidden /></Button>
          <p className="muted" style={{ textAlign: 'center' }}>{t('Already have an account?')} <Link to="/login">{t('Log in')}</Link></p>
        </div>
      ) : (
        <form className="stack" style={{ gap: 18 }} onSubmit={submit} noValidate>
          <button type="button" className="btn btn-text" onClick={() => setStep(0)} style={{ alignSelf: 'flex-start' }}><ArrowLeft size={18} className="flip" aria-hidden />{t('Back')}</button>
          <div>
            <p className="small muted">{t('Create account')} · {t('Step {a} of {b}', { a: 2, b: 2 })}</p>
            <h2>{t('Your details')}</h2>
          </div>
          {errors._ && <div className="banner banner-error" role="alert" style={{ margin: 0 }}>{errors._}</div>}
          <Field label={t('Full name')} error={errors.fullName}>{(a) => <input className="input" {...a} autoComplete="name" value={form.fullName} onChange={set('fullName')} />}</Field>
          <Field label={t('Mobile number')} error={errors.phone} hint={t('11 digits, starts with 03')}>
            {(a) => <input className="input latin" dir="ltr" {...a} inputMode="numeric" autoComplete="tel" placeholder="03001234567" value={form.phone} onChange={set('phone')} />}
          </Field>
          {role === 'staff' ? (
            <Field label={t('Work you do')} error={errors.primaryRole}>
              {(a) => <select className="select" {...a} value={form.primaryRole} onChange={set('primaryRole')}><option value="">{t('Choose…')}</option>{['Waiter', 'Security', 'Sound tech', 'Usher', 'Cleaner'].map((r) => <option key={r} value={r}>{t(r)}</option>)}</select>}
            </Field>
          ) : (
            <Field label={t('Company (optional)')} error={errors.company}>{(a) => <input className="input" {...a} autoComplete="organization" value={form.company} onChange={set('company')} />}</Field>
          )}
          <Field label={t('Password')} error={errors.password} hint={t('At least 8 characters with one number')}>
            {(a) => <PasswordInput {...a} autoComplete="new-password" value={form.password} onChange={set('password')} />}
          </Field>
          <Button type="submit" loading={loading} block>{t('Create account')}</Button>
        </form>
      )}
    </AuthFrame>
  );
}

