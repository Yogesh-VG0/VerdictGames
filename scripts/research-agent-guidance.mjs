// Download public instruction text for review, never install or execute it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const output = 'output/refinement-guidance';
mkdirSync(output, { recursive: true });
const results = [];
for (const repo of ['affaan-m/ECC','WorldFlowAI/everything-claude-code','supabase/agent-skills','vercel-labs/agent-skills','coreyhaines31/marketingskills']) {
  const metadataResponse = await fetch(`https://api.github.com/repos/${repo}`, { signal: AbortSignal.timeout(10000) });
  if (!metadataResponse.ok) { results.push({ repo, status: metadataResponse.status }); continue; }
  const metadata = await metadataResponse.json();
  const commitResponse = await fetch(`https://api.github.com/repos/${repo}/commits/${metadata.default_branch}`, { signal: AbortSignal.timeout(10000) });
  const commit = await commitResponse.json();
  const entry = { repo, archived: metadata.archived, pushedAt: metadata.pushed_at, license: metadata.license?.spdx_id, sha: commit.sha, skills: [] };
  const names = repo === 'affaan-m/ECC' ? ['verification-loop','tdd-workflow','security-review','e2e-testing','coding-standards','frontend-patterns','backend-patterns','postgres-patterns','deployment-patterns','skill-stocktake'] : repo === 'coreyhaines31/marketingskills' ? ['seo-audit'] : [];
  for (const skill of names) {
    const url = `https://raw.githubusercontent.com/${repo}/${commit.sha}/skills/${skill}/SKILL.md`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await response.text();
    const file = `${output}/${repo.split('/')[0]}-${skill}.md`;
    if (response.ok) writeFileSync(file, text);
    entry.skills.push({ skill, url, status: response.status, sha256: response.ok ? createHash('sha256').update(text).digest('hex') : null,
      executionReferences: response.ok ? text.split('\n').filter(line => /npx|npm install|curl |wget |hooks|permission|MCP|redis|supabase|postgres|script[s]?\//i.test(line)).slice(0,30) : [] });
  }
  results.push(entry);
}
writeFileSync(`${output}/inventory.json`, JSON.stringify(results, null, 2));
console.log(results.map(item => ({ repo:item.repo, sha:item.sha, pushedAt:item.pushedAt, license:item.license, reviewed:item.skills?.length })));
