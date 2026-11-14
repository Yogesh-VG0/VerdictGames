// Runs verification against loopback services only. Never print credentials or
// inherit application secrets from .env files into a verification process.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

const command = process.argv[2];
if (!['build', 'start', 'dev', 'security', 'migrate-security', 'browser-security', 'maintenance'].includes(command)) {
  throw new Error('Choose build, start, dev, security, migrate-security, browser-security, or maintenance');
}
const status = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
for (const address of [status.API_URL, status.DB_URL]) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(address).hostname)) {
    throw new Error('Verification requires loopback Supabase services');
  }
}
const env = { ...process.env };
for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) {
  if (existsSync(file)) {
    for (const key of Object.keys(parseEnv(readFileSync(file, 'utf8')))) env[key] = '';
  }
}
Object.assign(env, {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  SUPABASE_DB_URL: status.DB_URL,
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
  CRON_SECRET: 'local-verification-only',
  NODE_ENV: command === 'dev' ? 'development' : 'production',
});
if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) throw new Error('Local API keys unavailable');
const scripts = { security: 'test-local-security.mjs', 'migrate-security': 'apply-local-security.mjs', 'browser-security': 'test-local-auth-browser.mjs', maintenance: 'test-local-maintenance.mjs' };
const args = command in scripts
  ? [path.resolve('scripts', scripts[command])]
  : [path.resolve('node_modules/next/dist/bin/next'), command, ...(command === 'build' ? [] : ['--hostname', '127.0.0.1', '--port', '3100'])];
const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', () => { console.error('Unable to start local verification'); process.exitCode = 1; });
