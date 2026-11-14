// Verification build only. Never promote/deploy its prebuilt output: public
// runtime configuration is deliberately empty and has no production access.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { verificationEnv } from './lib/verification-env.mjs';
const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'build'], {
  stdio: 'inherit', env: verificationEnv({ NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SITE_URL: 'https://www.verdict.games' }),
});
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', () => { console.error('Unable to start isolated build'); process.exitCode = 1; });
