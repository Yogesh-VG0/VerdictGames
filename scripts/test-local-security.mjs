// Integration tests use disposable fixtures in loopback Supabase only.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, '127.0.0.1', 'Never run fixtures against hosted Supabase');
const app = 'http://127.0.0.1:3100';
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID().replaceAll('-', '').slice(0, 12);
const users = [];
const gameIds = [];
let checks = 0;

function check(condition, label) {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
}
function privateHeaders(response) {
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
    check(response.headers.get(name)?.includes('no-store'), `${name} prohibits shared storage`);
  }
}
async function api(path, user) {
  const response = await fetch(`${app}${path}`, { headers: user ? { cookie: user.cookie } : {} });
  assert.ok(response.headers.get('content-type')?.includes('application/json'), 'Expected application JSON');
  return { response, body: await response.json() };
}
async function createIdentity(index) {
  const email = `security-${run}-${index}@example.test`;
  const password = `Local-${randomBytes(18).toString('hex')}!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { preferred_username: `sec_${run}_${index}` } });
  assert.ifError(error);
  const identity = { id: data.user.id };
  users.push(identity);
  const { data: profile, error: profileError } = await admin.from('profiles').select('id,username').eq('auth_id', identity.id).single();
  assert.ifError(profileError);
  Object.assign(identity, { profileId: profile.id, username: profile.username });
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: cookies => cookies.forEach(({ name, value }) => jar.set(name, value)),
  } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  identity.client = client;
  identity.cookie = [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
  return identity;
}

try {
  const a = await createIdentity(1);
  const b = await createIdentity(2);
  const { data: game, error: gameError } = await admin.from('games').insert({
    slug: `security-fixture-${run}`, title: 'Security fixture', cover_image: '/icon.png',
    platforms: ['PC'], genres: ['Action'], release_date: '2025-01-01',
  }).select('id').single();
  assert.ifError(gameError);
  gameIds.push(game.id);
  const catalogueRows = ['Action', 'Strategy', 'Action', 'Strategy'].map((genre, index) => ({
    slug: `privacy-picks-${run}-${index}`, title: `Privacy Adventure ${index}`,
    cover_image: '/icon.png', platforms: ['PC'], genres: [genre],
    release_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    description: 'A polished adventure with varied challenges, memorable characters, and thoughtful progression.',
    score: 90, verdict_score: 90, verdict_label: 'MUST PLAY', confidence: 0.8,
    review_count: 5000, steam_total_count: 5000, score_source: 'steam', current_players: 3000,
  }));
  const { data: catalogue, error: catalogueError } = await admin.from('games').insert(catalogueRows).select('id,genres');
  assert.ifError(catalogueError);
  gameIds.push(...catalogue.map(row => row.id));
  const { error: libraryError } = await admin.from('user_games').insert([
    { user_id: a.profileId, game_id: catalogue[0].id, status: 'playing', notes: `Private A ${run}`, hours_played: 10 },
    { user_id: b.profileId, game_id: catalogue[1].id, status: 'playing', notes: `Private B ${run}`, hours_played: 20 },
  ]);
  assert.ifError(libraryError);
  const { data: review, error: reviewError } = await admin.from('reviews').insert({
    game_id: game.id, profile_id: a.profileId, rating: 85, title: 'Disposable security review', body: 'Temporary local fixture for cache isolation.', platform: 'PC',
  }).select('id').single();
  assert.ifError(reviewError);
  const { error: voteError } = await admin.from('review_votes').insert([
    { review_id: review.id, profile_id: a.profileId, value: 1 },
    { review_id: review.id, profile_id: b.profileId, value: -1 },
  ]);
  assert.ifError(voteError);

  for (const [user, expected] of [[a, 1], [b, -1], [null, 0]]) {
    for (const path of ['/api/reviews', `/api/games/security-fixture-${run}/reviews`, `/api/profile/${a.username}/reviews`]) {
      const { response, body } = await api(path, user);
      assert.equal(response.status, 200);
      privateHeaders(response);
      const item = (body.data.items ?? body.data).find(row => row.id === review.id);
      check(item?.userVote === expected, `${path} returns only the caller's vote (${expected})`);
    }
    const recommendations = await api('/api/recommendations?limit=2', user);
    assert.equal(recommendations.response.status, 200);
    privateHeaders(recommendations.response);
    check(recommendations.body.data.length > 0, 'recommendations contain real fixture results');
    if (user) {
      const genre = user === a ? 'Action' : 'Strategy';
      check(recommendations.body.data.every(row => row.genres.includes(genre)), 'recommendations follow only the caller library genre');
      check(!recommendations.body.data.some(row => row.id === catalogue[user === a ? 0 : 1].id), 'recommendations exclude caller-owned game');
    }
  }
  for (const user of [a, b]) {
    const me = await api('/api/auth/me', user);
    assert.equal(me.response.status, 200);
    privateHeaders(me.response);
    check(me.body.data.id === user.id, 'authenticated own-profile endpoint preserves identity');
    const library = await api('/api/library', user);
    assert.equal(library.response.status, 200);
    privateHeaders(library.response);
  }
  const anonymous = await api('/api/auth/me');
  check(anonymous.response.status === 401, 'anonymous own-profile request denied');
  privateHeaders(anonymous.response);
  console.log(`Local privacy integration: ${checks} checks passed`);
} finally {
  // Only fixtures created in this process are removed. Never enumerate/delete
  // existing users, games, storage objects, or unrelated local data.
  for (const id of gameIds) {
    const { error } = await admin.from('games').delete().eq('id', id);
    if (error) throw new Error('Unable to clean up local game fixture');
  }
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error('Unable to clean up local auth fixture');
  }
}
