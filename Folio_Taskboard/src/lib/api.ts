import { supabase } from './supabase';
import type { Activity, BoardData, Comment, Label, Member, Status, Task, TaskDraft } from './types';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function loadBoard(): Promise<BoardData> {
  const db = client();
  const [tasks, members, labels, assignments, links] = await Promise.all([
    db.from('tasks').select('*').order('created_at', { ascending: false }),
    db.from('team_members').select('*').order('created_at'),
    db.from('labels').select('*').order('created_at'),
    db.from('task_assignees').select('task_id,member_id'),
    db.from('task_labels').select('task_id,label_id'),
  ]);
  for (const result of [tasks, members, labels, assignments, links])
    if (result.error) throw result.error;
  return {
    tasks: (tasks.data ?? []).map((task) => ({
      ...task,
      assignee_ids: (assignments.data ?? [])
        .filter((item) => item.task_id === task.id)
        .map((item) => item.member_id),
      label_ids: (links.data ?? [])
        .filter((item) => item.task_id === task.id)
        .map((item) => item.label_id),
    })) as Task[],
    members: members.data as Member[],
    labels: labels.data as Label[],
  };
}

export async function saveTask(draft: TaskDraft, id: string | null): Promise<string> {
  const { data, error } = await client().rpc('save_task', {
    p_id: id,
    p_title: draft.title.trim(),
    p_description: draft.description.trim(),
    p_status: draft.status,
    p_priority: draft.priority,
    p_due_date: draft.due_date || null,
    p_assignee_ids: draft.assignee_ids,
    p_label_ids: draft.label_ids,
  });
  if (error) throw error;
  return data as string;
}

export async function moveTask(id: string, status: Status) {
  const { data, error } = await client()
    .from('tasks')
    .update({ status })
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('The task is no longer available. Refresh your board.');
}

export async function deleteTask(id: string) {
  const { error } = await client().from('tasks').delete().eq('id', id).select('id').single();
  if (error) throw error;
}

export async function loadDetails(id: string) {
  const [comments, activity] = await Promise.all([
    client().from('comments').select('*').eq('task_id', id).order('created_at'),
    client()
      .from('task_activity')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: false }),
  ]);
  if (comments.error) throw comments.error;
  if (activity.error) throw activity.error;
  return { comments: comments.data as Comment[], activity: activity.data as Activity[] };
}

export async function addComment(taskId: string, body: string) {
  const { error } = await client().from('comments').insert({ task_id: taskId, body: body.trim() });
  if (error) throw error;
}

export async function addDirectoryItem(kind: 'members' | 'labels', name: string, color: string) {
  const { error } = await client()
    .from(kind === 'members' ? 'team_members' : 'labels')
    .insert({ name: name.trim(), color });
  if (error) throw error;
}

export async function deleteDirectoryItem(kind: 'members' | 'labels', id: string) {
  const { error } = await client()
    .from(kind === 'members' ? 'team_members' : 'labels')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
