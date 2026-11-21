// Small fetch wrapper. Every error comes back as { code, message } in plain words.
const listeners = new Set();
export const onSessionExpired = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Something went wrong. Please try again.');
    this.status = status;
    this.code = body?.code || 'UNKNOWN';
    this.body = body || {};
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, { code: 'OFFLINE', message: 'No internet. Check your connection and try again.' });
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && data?.code === 'SESSION_EXPIRED') listeners.forEach((fn) => fn());
    if (res.status >= 500 && !data?.message) data = { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again in a minute.' };
    throw new ApiError(res.status, data);
  }
  return data;
}

export const get = (p, o) => api(p, o);
export const post = (p, body) => api(p, { method: 'POST', body: body || {} });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const del = (p) => api(p, { method: 'DELETE' });
