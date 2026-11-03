import type { Filters, Task, TaskDraft, Status } from './types';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dueState(due: string | null, status: Status, now = new Date()) {
  if (!due || status === 'done') return 'none';
  if (due < localDate(now)) return 'overdue';
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 2);
  return due <= localDate(soon) ? 'soon' : 'later';
}

export function filterTasks(tasks: Task[], filters: Filters, now = new Date()): Task[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter(
    (task) =>
      (!query || task.title.toLocaleLowerCase().includes(query)) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.assignee || task.assignee_ids.includes(filters.assignee)) &&
      (!filters.label || task.label_ids.includes(filters.label)) &&
      (filters.view !== 'completed' || task.status === 'done') &&
      (filters.view !== 'due' ||
        ['soon', 'overdue'].includes(dueState(task.due_date, task.status, now))),
  );
}

export function blankDraft(status: Status = 'todo'): TaskDraft {
  return {
    title: '',
    description: '',
    status,
    priority: 'normal',
    due_date: '',
    assignee_ids: [],
    label_ids: [],
  };
}

export function taskDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date ?? '',
    assignee_ids: [...task.assignee_ids],
    label_ids: [...task.label_ids],
  };
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function readableDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Something went wrong. Please try again.';
}
