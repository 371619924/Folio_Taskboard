import assert from 'node:assert/strict';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key || url.includes('your-project') || key.includes('your-public')) {
  console.error('Configure .env.local with your Supabase URL and public anon key first.');
  process.exit(1);
}
if (
  key.startsWith('sb_secret_') ||
  (key.split('.').length === 3 &&
    JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon')
) {
  throw new Error('This test accepts only a public anon key.');
}

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const a = createClient(url, key, options);
const b = createClient(url, key, options);
const cleanups = [];
function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

try {
  const userA = unwrap(await a.auth.signInAnonymously()).user.id;
  const userB = unwrap(await b.auth.signInAnonymously()).user.id;
  assert.notEqual(userA, userB);
  const member = unwrap(
    await a
      .from('team_members')
      .insert({ name: 'Connection test member', color: '#7861dc' })
      .select()
      .single(),
  );
  cleanups.push(() => a.from('team_members').delete().eq('id', member.id));
  const label = unwrap(
    await a
      .from('labels')
      .insert({ name: 'Connection test label', color: '#4587c2' })
      .select()
      .single(),
  );
  cleanups.push(() => a.from('labels').delete().eq('id', label.id));
  const taskId = unwrap(
    await a.rpc('save_task', {
      p_id: null,
      p_title: 'Connection test task',
      p_description: 'Temporary verification record',
      p_status: 'todo',
      p_priority: 'normal',
      p_due_date: null,
      p_assignee_ids: [member.id],
      p_label_ids: [label.id],
    }),
  );
  cleanups.push(() => a.from('tasks').delete().eq('id', taskId));
  unwrap(await a.from('comments').insert({ task_id: taskId, body: 'Connection test comment' }));
  const ownTask = unwrap(await a.from('tasks').select('*').eq('id', taskId).single());
  assert.equal(ownTask.user_id, userA);
  for (const table of [
    'tasks',
    'team_members',
    'labels',
    'task_assignees',
    'task_labels',
    'comments',
    'task_activity',
  ]) {
    assert.deepEqual(
      unwrap(await b.from(table).select('*').eq('user_id', userA)),
      [],
      `${table} leaked another guest's data`,
    );
  }
  assert.deepEqual(
    unwrap(await b.from('tasks').update({ title: 'Unauthorized' }).eq('id', taskId).select()),
    [],
  );
  const denied = await b.from('comments').insert({ task_id: taskId, body: 'Unauthorized' });
  assert.ok(denied.error, 'Cross-guest comment insertion should fail');
  unwrap(await a.from('tasks').update({ status: 'in_review' }).eq('id', taskId).select().single());
  const history = unwrap(await a.from('task_activity').select('*').eq('task_id', taskId));
  assert.ok(history.some((item) => item.message.includes('To Do → In Review')));
  const comments = unwrap(await a.from('comments').select('*').eq('task_id', taskId));
  assert.equal(comments.length, 1);
  console.log(
    'PASS: anonymous sessions, persistence, all seven RLS boundaries, denied writes, comments, assignments, labels and activity.',
  );
} finally {
  for (const cleanup of cleanups.reverse()) {
    try {
      unwrap(await cleanup());
    } catch {
      console.error('A temporary verification record could not be removed. Check your dashboard.');
    }
  }
  await a.auth.signOut({ scope: 'local' });
  await b.auth.signOut({ scope: 'local' });
}
