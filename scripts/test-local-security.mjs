// Integration tests use disposable fixtures in loopback Supabase only.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import postgres from 'postgres';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, '127.0.0.1', 'Never run fixtures against hosted Supabase');
const app = 'http://127.0.0.1:3100';
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID().replaceAll('-', '').slice(0, 12);
const localClientIp = `127.3.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const users = [];
const gameIds = [];
const avatarPaths = [];
const listIds = [];
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
  const response = await fetch(`${app}${path}`, { headers: { 'x-forwarded-for': localClientIp, ...(user ? { cookie: user.cookie } : {}) } });
  assert.ok(response.headers.get('content-type')?.includes('application/json'), 'Expected application JSON');
  return { response, body: await response.json() };
}
async function mutate(path, user, body, method = 'POST') {
  const response = await fetch(`${app}${path}`, { method, headers: {
    cookie: user.cookie, origin: app, 'content-type': 'application/json', 'x-forwarded-for': localClientIp,
  }, body: JSON.stringify(body) });
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
  const anonymousClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const client of [anonymousClient, a.client, b.client]) {
    const secretProfile = await client.from('profiles').select('auth_id,role').eq('id', a.profileId);
    check(Boolean(secretProfile.error), 'raw API cannot select private profile identity or role');
    const publicProfile = await client.from('profiles').select('id,username,display_name').eq('id', a.profileId).single();
    check(!publicProfile.error && publicProfile.data.username === a.username, 'public profile fields remain available');
  }
  check(Boolean((await anonymousClient.from('user_games').select('notes')).error), 'anonymous raw library read denied by effective privileges');
  for (const [owner, other] of [[a, b], [b, a]]) {
    const own = await owner.client.from('user_games').select('notes,hours_played').eq('user_id', owner.profileId);
    check(!own.error && own.data.length === 1, 'owner can read their private notes and hours');
    const foreign = await owner.client.from('user_games').select('notes').eq('user_id', other.profileId);
    check(!foreign.error && foreign.data.length === 0, 'authenticated raw library cannot read another owner');
    const escalation = await owner.client.from('profiles').update({ role: 'admin' }).eq('id', owner.profileId);
    check(Boolean(escalation.error), 'profile role escalation denied by privileges');
  }
  const db = postgres(process.env.SUPABASE_DB_URL, { max: 1 });
  try {
    const [permissions] = await db`select
      has_column_privilege('anon','public.profiles','role','SELECT') role_read,
      has_column_privilege('authenticated','public.profiles','auth_id','SELECT') auth_read,
      has_table_privilege('anon','public.games','INSERT') anon_insert,
      has_table_privilege('authenticated','public.games','UPDATE') user_catalogue_write,
      has_table_privilege('authenticated','public.user_games','TRUNCATE') truncate_library,
      has_table_privilege('anon','public.reviews','DELETE') anonymous_review_delete`;
    check(Object.values(permissions).every(value => value === false), 'effective database privileges deny private columns and unnecessary commands');
  } finally { await db.end(); }

  const { data: privateList, error: listError } = await admin.from('lists').insert({
    slug: `private-list-${run}`, title: 'Private local list', owner_id: a.profileId, is_public: false,
  }).select('id').single();
  assert.ifError(listError);
  listIds.push(privateList.id);
  check((await a.client.from('lists').select('id').eq('id', privateList.id)).data?.length === 1, 'owner retains private-list access');
  check((await b.client.from('lists').select('id').eq('id', privateList.id)).data?.length === 0, 'second user cannot read private list');
  check((await anonymousClient.from('lists').select('id').eq('id', privateList.id)).data?.length === 0, 'anonymous cannot read private list');

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1sAAAAASUVORK5CYII=', 'base64');
  const avatar = `${a.id}.png`;
  const upload = await a.client.storage.from('avatars').upload(avatar, png, { contentType: 'image/png' });
  assert.ifError(upload.error);
  avatarPaths.push(avatar);
  check(!upload.error, 'owner can upload legacy UUID avatar');
  check(Boolean((await b.client.storage.from('avatars').update(avatar, png, { contentType: 'image/png' })).error), 'second user cannot overwrite owner avatar');
  check(Boolean((await b.client.storage.from('avatars').upload(avatar, png, { contentType: 'image/png', upsert: true })).error), 'second user cannot upsert owner avatar');
  check(!(await a.client.storage.from('avatars').update(avatar, png, { contentType: 'image/png' })).error, 'owner can replace own avatar');
  const avatarUrl = anonymousClient.storage.from('avatars').getPublicUrl(avatar).data.publicUrl;
  check((await fetch(avatarUrl)).ok, 'existing public avatar URL remains readable');
  const folderAvatar = `${b.id}/avatar.png`;
  const folderUpload = await b.client.storage.from('avatars').upload(folderAvatar, png, { contentType: 'image/png' });
  assert.ifError(folderUpload.error);
  avatarPaths.push(folderAvatar);
  check(!folderUpload.error, 'owner UUID-folder upload works');

  const publicActivity = await api(`/api/profile/${a.username}`);
  check(publicActivity.response.status === 200 && publicActivity.body.data.libraryCount === 1, 'public profile retains intentional library count');
  const publicBody = JSON.stringify(publicActivity.body);
  check(!publicBody.includes(`Private A ${run}`) && !publicBody.includes('hoursPlayed') && !publicBody.includes('auth_id') && !publicBody.includes('"role"'), 'public profile projection excludes private fields');
  for (const owner of [a, b]) {
    const ownLibrary = await api('/api/library', owner);
    check(ownLibrary.body.data.length === 1 && ownLibrary.body.data[0].userId === owner.profileId, 'library API returns only the authenticated owner');
    const stats = await api('/api/library/stats', owner);
    check(stats.response.status === 200 && stats.body.data.totalHours === (owner === a ? 10 : 20), 'owner library statistics still work');
    const forbiddenAdmin = await api('/api/admin/users', owner);
    check(forbiddenAdmin.response.status === 403, 'non-admin application request denied');
  }
  check((await api('/api/admin/users')).response.status === 401, 'anonymous admin request denied');
  const promoteFixture = await admin.from('profiles').update({ role: 'admin' }).eq('id', a.profileId);
  assert.ifError(promoteFixture.error);
  check((await api('/api/auth/me', a)).body.data.role === 'admin', 'verified admin own-profile role preserved');
  check((await api('/api/admin/users', a)).response.status === 200, 'verified administrator retains authorized API access');
  check((await a.client.rpc('is_admin_user')).data === true, 'restricted admin policy helper recognizes only caller administrator');
  check((await b.client.rpc('is_admin_user')).data === false, 'restricted admin policy helper rejects ordinary caller');
  check(Boolean((await anonymousClient.rpc('is_admin_user')).error), 'anonymous cannot execute administrator helper');
  const editorialRows = await admin.from('editorial_reviews').insert([
    { game_id: game.id, author_id: a.profileId, content: 'Published local editorial', is_published: true },
    { game_id: catalogue[0].id, author_id: a.profileId, content: 'Unpublished local editorial', is_published: false },
  ]).select('id,is_published');
  assert.ifError(editorialRows.error);
  const editorialIds = editorialRows.data.map(row => row.id);
  for (const [client, expected] of [[anonymousClient, 1], [b.client, 1], [a.client, 2]]) {
    const visible = await client.from('editorial_reviews').select('id').in('id', editorialIds);
    check(!visible.error && visible.data.length === expected, 'editorial publication/admin RLS survives private role restriction');
  }
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
  const newReview = await mutate('/api/reviews', b, { gameId: game.id, rating: 80,
    title: 'Another local review', bodyText: 'Local regression test of an owner-authenticated review.', platform: 'PC' });
  check(newReview.response.ok && newReview.body.success, 'owner review creation still works through guarded API');
  const comment = await mutate(`/api/reviews/${review.id}/comments`, b, { body: 'Local owner comment' });
  check(comment.response.ok && comment.body.success, 'owner comment creation still works');
  const vote = await mutate(`/api/reviews/${review.id}/vote`, b, { value: 1 });
  check(vote.response.ok && vote.body.data.userVote === 1, 'owner vote mutation still works');
  const following = await mutate('/api/follow', b, { targetProfileId: a.profileId, action: 'follow', follower_id: a.profileId });
  check(following.response.ok && following.body.data.following, 'follow mutation uses verified caller');
  const persistedFollow = await admin.from('follows').select('follower_id').eq('following_id', a.profileId).eq('follower_id', b.profileId).single();
  check(persistedFollow.data?.follower_id === b.profileId, 'spoofed follower ID is ignored');
  const update = await mutate('/api/profile/settings', b, { display_name: 'Updated local player', role: 'admin' }, 'PATCH');
  check(update.response.ok, 'presentation profile update still works');
  check((await api('/api/auth/me', b)).body.data.role === 'user', 'presentation update cannot smuggle administrator role');
  const limiterClient = `127.4.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
  const statuses = [];
  for (let index = 0; index < 11; index++) {
    statuses.push((await fetch(`${app}/api/auth/me`, { headers: { 'x-forwarded-for': limiterClient } })).status);
  }
  check(statuses.slice(0, 10).every(status => status === 401) && statuses[10] === 429, 'authentication limiter still rejects the eleventh request');
  console.log(`Local privacy integration: ${checks} checks passed`);
} finally {
  // Only fixtures created in this process are removed. Never enumerate/delete
  // existing users, games, storage objects, or unrelated local data.
  const cleanupErrors = [];
  if (avatarPaths.length) {
    const { error } = await admin.storage.from('avatars').remove(avatarPaths);
    if (error) cleanupErrors.push('avatar fixtures');
  }
  for (const id of listIds) {
    const { error } = await admin.from('lists').delete().eq('id', id);
    if (error) cleanupErrors.push('list fixture');
  }
  for (const id of gameIds) {
    const { error } = await admin.from('games').delete().eq('id', id);
    if (error) cleanupErrors.push('game fixture');
  }
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) cleanupErrors.push('auth fixture');
  }
  if (cleanupErrors.length) throw new Error(`Unable to clean up local ${cleanupErrors.join(', ')}`);
}
