export const COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#9197a6' },
  { id: 'in_progress', title: 'In Progress', color: '#7861dc' },
  { id: 'in_review', title: 'In Review', color: '#df9d3c' },
  { id: 'done', title: 'Done', color: '#4b9f84' },
] as const;

export type Status = (typeof COLUMNS)[number]['id'];
export type Priority = 'low' | 'normal' | 'high';
export interface Member {
  id: string;
  user_id: string;
  name: string;
  color: string;
}
export interface Label {
  id: string;
  user_id: string;
  name: string;
  color: string;
}
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assignee_ids: string[];
  label_ids: string[];
}
export interface TaskDraft {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string;
  assignee_ids: string[];
  label_ids: string[];
}
export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
}
export interface Activity {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  created_at: string;
}
export interface BoardData {
  tasks: Task[];
  members: Member[];
  labels: Label[];
}
export interface Filters {
  query: string;
  priority: string;
  assignee: string;
  label: string;
  view: 'all' | 'due' | 'completed';
}
