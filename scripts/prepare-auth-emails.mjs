// Generates reviewable, dependency-free Supabase templates. No hosted writes.
import { mkdirSync, writeFileSync } from 'node:fs';
const folder = 'supabase/templates';
mkdirSync(folder, { recursive: true });
const messages = [
  ['confirmation', 'Confirm your VerdictGames account', 'Welcome to VerdictGames', 'Confirm your email to start saving games, building collections and sharing your verdicts.', 'Confirm email', 'If you did not create this account, you can ignore this email.'],
  ['recovery', 'Reset your VerdictGames password', 'Choose a new password', 'We received a request to reset your password. Continue to choose a new, unique password.', 'Reset password', 'If you did not request this, ignore this email. Your password has not changed.'],
  ['email-change', 'Confirm your new VerdictGames email', 'Confirm your email change', 'Confirm this email address for your VerdictGames account. You may also need to confirm the change from your original inbox.', 'Confirm email change', 'If you did not request this, secure your account and contact support through VerdictGames.'],
  ['magic-link', 'Your VerdictGames sign-in link', 'Sign in to VerdictGames', 'Use this single-use link to continue signing in to your account.', 'Sign in', 'If you did not request this, ignore this email. Do not share this link.'],
];
for (const [file, subject, title, copy, action, safety] of messages) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:24px 12px;background:#eef1f7;color:#182031;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${subject}. This link is personal and single-use.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d5dbe6;border-radius:20px"><tr><td style="padding:32px 28px">
<p style="margin:0 0 28px;font-size:20px;font-weight:bold;color:#334dc7">VERDICT<span style="color:#485369;font-weight:normal">.games</span></p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#182031">${title}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6">${copy}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#334dc7" style="border-radius:10px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">${action}</a></td></tr></table>
<p style="margin:24px 0 12px;font-size:14px;line-height:1.6;color:#485369">This link can be used once and expires according to our account security settings. If it has expired, request a new link from VerdictGames.</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#485369">If the button does not work, copy this link into your browser:</p>
<p style="margin:0 0 24px;word-break:break-all;overflow-wrap:anywhere;font-size:12px;line-height:1.6"><a href="{{ .ConfirmationURL }}" style="color:#334dc7">{{ .ConfirmationURL }}</a></p>
<p style="border-top:1px solid #d5dbe6;padding-top:20px;margin:0;font-size:13px;line-height:1.6;color:#485369">${safety} VerdictGames will never ask you to send your password by email.</p>
</td></tr></table><p style="font-size:12px;color:#485369">Your next game starts with a verdict.</p>
</td></tr></table></body></html>
`;
  writeFileSync(`${folder}/${file}.html`, html);
}
console.log('Prepared four HTML email templates; no provider configuration changed.');
