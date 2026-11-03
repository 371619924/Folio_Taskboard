// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const A = '10000000-0000-0000-0000-000000000001';
const B = '10000000-0000-0000-0000-000000000002';
const TA = '20000000-0000-0000-0000-000000000001';
const TB = '20000000-0000-0000-0000-000000000002';
const MA = '30000000-0000-0000-0000-000000000001';
const MB = '30000000-0000-0000-0000-000000000002';
const LA = '40000000-0000-0000-0000-000000000001';
const LB = '40000000-0000-0000-0000-000000000002';
let db: PGlite;
async function asUser(id: string) {
  await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`);
}
async function save(
  id: string | null,
  title: string,
  memberIds: string[] = [],
  labelIds: string[] = [],
) {
  return db.query<{ id: string }>(
    'select public.save_task($1, $2, $3, $4, $5, $6, $7::uuid[], $8::uuid[]) as id',
    [id, title, 'Context', 'todo', 'high', '2026-11-04', memberIds, labelIds],
  );
}

describe('database security and persistence', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${A}'), ('${B}');
    `);
    await db.exec(readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8'));
  });
  beforeEach(async () => {
    await db.exec(`reset role; truncate public.tasks, public.team_members, public.labels cascade;
      insert into public.tasks(id,user_id,title) values ('${TA}','${A}','A task'),('${TB}','${B}','B task');
      insert into public.team_members(id,user_id,name) values ('${MA}','${A}','A member'),('${MB}','${B}','B member');
      insert into public.labels(id,user_id,name) values ('${LA}','${A}','A label'),('${LB}','${B}','B label');
      insert into public.task_assignees values ('${TA}','${MA}','${A}'),('${TB}','${MB}','${B}');
      insert into public.task_labels values ('${TA}','${LA}','${A}'),('${TB}','${LB}','${B}');
      insert into public.comments(task_id,user_id,body) values ('${TA}','${A}','A comment'),('${TB}','${B}','B comment');
    `);
    await asUser(A);
  });
  afterAll(async () => {
    await db?.close();
  });

  for (const table of [
    'tasks',
    'team_members',
    'labels',
    'task_assignees',
    'task_labels',
    'comments',
    'task_activity',
  ]) {
    it(`isolates ${table} between guests`, async () => {
      const visible = await db.query<{ user_id: string }>(`select user_id from public.${table}`);
      expect(visible.rows.length).toBeGreaterThan(0);
      expect(visible.rows.every((row) => row.user_id === A)).toBe(true);
      await asUser(B);
      const other = await db.query<{ user_id: string }>(`select user_id from public.${table}`);
      expect(other.rows.length).toBeGreaterThan(0);
      expect(other.rows.every((row) => row.user_id === B)).toBe(true);
    });
  }
  it('cannot update or delete another guest’s task', async () => {
    expect(
      (await db.query('update public.tasks set title=$1 where id=$2 returning id', ['Changed', TB]))
        .rows,
    ).toEqual([]);
    expect(
      (await db.query('delete from public.tasks where id=$1 returning id', [TB])).rows,
    ).toEqual([]);
    await expect(save(TB, 'Changed')).rejects.toThrow('Task not found');
  });
  it('rejects forged ownership and cross-guest comments', async () => {
    await expect(
      db.query('insert into public.tasks(user_id,title) values ($1,$2)', [B, 'Forged']),
    ).rejects.toThrow();
    await expect(
      db.query('insert into public.comments(task_id,body) values ($1,$2)', [TB, 'Forged']),
    ).rejects.toThrow();
  });
  it('rejects foreign members and labels even when the attacker owns the task', async () => {
    await expect(
      db.query('insert into public.task_assignees values ($1,$2,$3)', [TA, MB, A]),
    ).rejects.toThrow();
    await expect(
      db.query('insert into public.task_labels values ($1,$2,$3)', [TA, LB, A]),
    ).rejects.toThrow();
  });
  it('atomically creates tasks with multiple assignment and label links', async () => {
    const created = await save(null, '  New task  ', [MA], [LA]);
    const id = created.rows[0].id;
    const task = await db.query<{ title: string; user_id: string }>(
      'select title,user_id from public.tasks where id=$1',
      [id],
    );
    expect(task.rows[0]).toEqual({ title: 'New task', user_id: A });
    expect(
      (await db.query('select * from public.task_assignees where task_id=$1', [id])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query('select * from public.task_labels where task_id=$1', [id])).rows,
    ).toHaveLength(1);
    expect(
      (await db.query('select * from public.task_activity where task_id=$1', [id])).rows,
    ).toHaveLength(3);
  });
  it('rolls back task edits and history if a linked record belongs to another guest', async () => {
    await expect(save(TA, 'Should roll back', [MB], [LA])).rejects.toThrow();
    expect(
      (await db.query<{ title: string }>('select title from public.tasks where id=$1', [TA]))
        .rows[0].title,
    ).toBe('A task');
    expect(
      (await db.query('select * from public.task_assignees where task_id=$1', [TA])).rows,
    ).toHaveLength(1);
  });
  it('replaces links without duplicating unchanged activity', async () => {
    await save(TA, 'Updated', [MA], [LA]);
    const first = (await db.query('select * from public.task_activity where task_id=$1', [TA])).rows
      .length;
    await save(TA, 'Updated', [MA], [LA]);
    expect(
      (await db.query('select * from public.task_activity where task_id=$1', [TA])).rows,
    ).toHaveLength(first);
    await save(TA, 'Updated', [], []);
    expect(
      (await db.query('select * from public.task_assignees where task_id=$1', [TA])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query('select * from public.task_labels where task_id=$1', [TA])).rows,
    ).toHaveLength(0);
  });
  it('records status changes and prevents clients from forging activity', async () => {
    await db.query('update public.tasks set status=$1 where id=$2', ['in_progress', TA]);
    expect(
      (
        await db.query<{ message: string }>(
          'select message from public.task_activity where task_id=$1',
          [TA],
        )
      ).rows.some((row) => row.message.includes('To Do → In Progress')),
    ).toBe(true);
    await expect(
      db.query('insert into public.task_activity(task_id,user_id,message) values ($1,$2,$3)', [
        TA,
        A,
        'Fake',
      ]),
    ).rejects.toThrow();
    await expect(
      db.query('delete from public.task_activity where task_id=$1', [TA]),
    ).rejects.toThrow();
  });
  it('deletes a task and cascades its comments, links and history', async () => {
    await db.query('delete from public.tasks where id=$1', [TA]);
    for (const table of ['comments', 'task_assignees', 'task_labels', 'task_activity']) {
      expect(
        (await db.query(`select * from public.${table} where task_id=$1`, [TA])).rows,
      ).toHaveLength(0);
    }
  });
  it('rejects invalid task content', async () => {
    await expect(save(null, '   ')).rejects.toThrow();
    await expect(
      db.query('update public.tasks set status=$1 where id=$2', ['unknown', TA]),
    ).rejects.toThrow();
  });
  it('denies unauthenticated access', async () => {
    await db.exec('reset role; set role anon;');
    await expect(db.query('select * from public.tasks')).rejects.toThrow();
    await expect(save(null, 'Unauthenticated')).rejects.toThrow();
  });
});
