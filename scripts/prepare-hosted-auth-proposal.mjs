// Exact reviewable PATCH payload only; never calls a hosted API.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const payload={password_min_length:15};
const messages=[['confirmation','confirmation','Confirm your VerdictGames account'],['recovery','recovery','Reset your VerdictGames password'],
  ['email_change','email-change','Confirm your new VerdictGames email'],['magic_link','magic-link','Your VerdictGames sign-in link']];
const templates=[];
for(const [key,file,subject] of messages) {
  const path='supabase/templates/'+file+'.html',html=readFileSync(path,'utf8');
  assert.equal((html.match(/\{\{ \.ConfirmationURL \}\}/g)||[]).length,3);
  assert.ok(!/<(?:script|img|iframe)\b/i.test(html));
  payload['mailer_subjects_'+key]=subject;payload['mailer_templates_'+key+'_content']=html;
  templates.push({path,subject,sha256:createHash('sha256').update(html).digest('hex')});
}
assert.equal(Object.keys(payload).length,9);
writeFileSync('docs/audits/2026-11-15/auth-change-proposal.json',JSON.stringify(payload,null,2)+'\n');
writeFileSync('output/targeted-release/auth-proposal-manifest.json',JSON.stringify({fields:Object.keys(payload),templates,
  preserved:'All unlisted Auth settings including SMTP, sender, OAuth providers/secrets, confirmations, redirect/site URLs, secure email change and token expiry.',
  applied:false},null,2));
console.log(JSON.stringify({preparedFields:Object.keys(payload),templates,hostedChanges:false},null,2));
