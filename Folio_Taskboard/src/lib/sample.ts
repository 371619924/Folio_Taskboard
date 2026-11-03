import { localDate } from './board';
import type { BoardData } from './types';

export function sampleBoard(): BoardData {
  const date = (offset: number) => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    return localDate(day);
  };
  const user_id = 'sample';
  const members = [
    { id: 'm1', user_id, name: 'Alex Chen', color: '#7861dc' },
    { id: 'm2', user_id, name: 'Jamie Lee', color: '#cd8a60' },
    { id: 'm3', user_id, name: 'Sam Rivera', color: '#4b9f84' },
  ];
  const labels = [
    { id: 'l1', user_id, name: 'Design', color: '#7861dc' },
    { id: 'l2', user_id, name: 'Engineering', color: '#4587c2' },
    { id: 'l3', user_id, name: 'Research', color: '#b07b38' },
  ];
  const base = {
    user_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: '',
    assignee_ids: [],
    label_ids: [],
  };
  return {
    members,
    labels,
    tasks: [
      {
        ...base,
        id: 's1',
        title: 'Explore the next chapter',
        description: 'Collect references and sketch a few directions for the next release.',
        status: 'todo',
        priority: 'normal',
        due_date: date(2),
        label_ids: ['l3'],
        assignee_ids: ['m1'],
      },
      {
        ...base,
        id: 's2',
        title: 'Map the onboarding journey',
        description:
          'Outline the first five minutes, from the welcome screen to the first completed task.',
        status: 'todo',
        priority: 'high',
        due_date: date(4),
        label_ids: ['l1'],
        assignee_ids: ['m2', 'm1'],
      },
      {
        ...base,
        id: 's3',
        title: 'Build the component library',
        description: 'A small set of thoughtful building blocks, made to work together.',
        status: 'in_progress',
        priority: 'high',
        due_date: date(0),
        label_ids: ['l1', 'l2'],
        assignee_ids: ['m1', 'm3'],
      },
      {
        ...base,
        id: 's4',
        title: 'Connect the data layer',
        description: 'Keep every change saved and every workspace private.',
        status: 'in_progress',
        priority: 'normal',
        due_date: date(-1),
        label_ids: ['l2'],
        assignee_ids: ['m3'],
      },
      {
        ...base,
        id: 's5',
        title: 'Review the mobile layouts',
        description: 'Check the details on smaller screens.',
        status: 'in_review',
        priority: 'normal',
        due_date: date(1),
        label_ids: ['l1'],
        assignee_ids: ['m2'],
      },
      {
        ...base,
        id: 's6',
        title: 'Define the visual direction',
        description: 'Quiet colors, clear hierarchy, and room to focus.',
        status: 'done',
        priority: 'low',
        due_date: date(-2),
        label_ids: ['l1'],
        assignee_ids: ['m2'],
      },
      {
        ...base,
        id: 's7',
        title: 'Set up the workspace',
        description: 'The foundations are in place.',
        status: 'done',
        priority: 'normal',
        due_date: null,
        label_ids: ['l2'],
        assignee_ids: ['m3'],
      },
    ],
  };
}
