import { describe, expect, it } from 'vitest';
import { blankDraft, dueState, filterTasks, initials, localDate } from './board';
import type { Filters, Task } from './types';

const now = new Date(2026, 10, 2, 23, 30);
const filters: Filters = { query: '', priority: '', assignee: '', label: '', view: 'all' };
const base: Task = {
  id: '1',
  user_id: 'a',
  title: 'Connect the database',
  description: 'Context',
  status: 'todo',
  priority: 'high',
  due_date: '2026-11-01',
  created_at: '',
  updated_at: '',
  assignee_ids: ['member'],
  label_ids: ['label'],
};

describe('board rules', () => {
  it('treats calendar dates as local dates, including month boundaries', () => {
    expect(localDate(now)).toBe('2026-11-02');
    expect(dueState('2026-11-01', 'todo', now)).toBe('overdue');
    expect(dueState('2026-11-02', 'in_progress', now)).toBe('soon');
    expect(dueState('2026-11-04', 'in_review', now)).toBe('soon');
    expect(dueState('2026-11-05', 'todo', now)).toBe('later');
    expect(dueState('2026-12-01', 'todo', new Date(2026, 10, 30))).toBe('soon');
  });
  it('excludes completed and undated tasks from due-date alerts', () => {
    expect(dueState('2026-10-01', 'done', now)).toBe('none');
    expect(dueState(null, 'todo', now)).toBe('none');
  });
  it('combines title search, priority, assignee and label filters', () => {
    expect(
      filterTasks(
        [base],
        { ...filters, query: ' DATABASE ', priority: 'high', assignee: 'member', label: 'label' },
        now,
      ),
    ).toHaveLength(1);
    expect(filterTasks([base], { ...filters, label: 'other' }, now)).toHaveLength(0);
    expect(filterTasks([base], { ...filters, priority: 'low' }, now)).toHaveLength(0);
    expect(filterTasks([base], { ...filters, assignee: 'other' }, now)).toHaveLength(0);
  });
  it('keeps due and completed navigation views separate', () => {
    const done: Task = { ...base, id: '2', status: 'done' };
    expect(
      filterTasks([base, done], { ...filters, view: 'due' }, now).map((item) => item.id),
    ).toEqual(['1']);
    expect(
      filterTasks([base, done], { ...filters, view: 'completed' }, now).map((item) => item.id),
    ).toEqual(['2']);
  });
  it('uses fresh arrays in each draft and readable initials', () => {
    const first = blankDraft('in_review');
    first.label_ids.push('x');
    expect(blankDraft().label_ids).toEqual([]);
    expect(first.status).toBe('in_review');
    expect(initials('  Alex  Chen ')).toBe('AC');
  });
});
