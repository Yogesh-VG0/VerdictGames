import { missingMaintenanceSecrets } from './lib/maintenance-config.mjs';

const missing = missingMaintenanceSecrets(process.env.JOB, process.env);
if (missing.length) {
  console.error(`::error::Missing GitHub Actions secrets: ${missing.join(', ')}`);
  process.exitCode = 1;
}
