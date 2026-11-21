// Starts the API (port 4000) and the Vite dev server (port 5173) together.
const { spawn } = require('child_process');
const path = require('path');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (dir, script, color) => {
  const p = spawn(npm, ['run', script], { cwd: path.join(__dirname, '..', dir), shell: process.platform === 'win32' });
  const tag = `\x1b[${color}m[${dir}]\x1b[0m `;
  p.stdout.on('data', (d) => process.stdout.write(tag + d));
  p.stderr.on('data', (d) => process.stderr.write(tag + d));
  return p;
};
const procs = [run('server', 'dev', 36), run('client', 'dev', 35)];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
