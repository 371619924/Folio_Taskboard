import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, CalendarDays, Check, GripVertical, Minus } from 'lucide-react';
import { dueState, initials, readableDate } from '../lib/board';
import type { Label, Member, Task } from '../lib/types';

export function Avatars({ ids, members }: { ids: string[]; members: Member[] }) {
  return (
    <span className="avatars">
      {ids.slice(0, 3).map((id) => {
        const member = members.find((item) => item.id === id);
        return member ? (
          <span
            className="avatar"
            key={id}
            style={{ background: member.color }}
            title={member.name}
          >
            {initials(member.name)}
          </span>
        ) : null;
      })}
      {ids.length > 3 && <span className="avatar overflow-avatar">+{ids.length - 3}</span>}
    </span>
  );
}

export function TaskCard({
  task,
  members,
  labels,
  onOpen,
  disabled,
}: {
  task: Task;
  members: Member[];
  labels: Label[];
  onOpen: (task: Task) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
    disabled,
  });
  const urgency = dueState(task.due_date, task.status);
  return (
    <article
      ref={setNodeRef}
      className={`task-card ${isDragging ? 'dragging' : ''} ${task.status === 'done' ? 'completed-card' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className="card-top">
        <div className="card-labels">
          {task.label_ids.map((id) => {
            const label = labels.find((item) => item.id === id);
            return label ? (
              <span
                className="tag"
                key={id}
                style={{ color: label.color, background: `${label.color}16` }}
              >
                {label.name}
              </span>
            ) : null;
          })}
          {!task.label_ids.length && (
            <span className="task-reference">TASK · {task.id.slice(0, 4).toUpperCase()}</span>
          )}
        </div>
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`Drag ${task.title}`}
          title="Drag to move; or open task and change status"
        >
          <GripVertical size={17} />
        </button>
      </div>
      <button className="task-title" onClick={() => onOpen(task)}>
        {task.status === 'done' && <Check size={15} />}
        <span>{task.title}</span>
      </button>
      {task.description && <p className="card-description">{task.description}</p>}
      <div className="card-footer">
        <span className={`priority ${task.priority}`} title={`${task.priority} priority`}>
          {task.priority === 'high' ? (
            <ArrowUp size={13} />
          ) : task.priority === 'low' ? (
            <ArrowDown size={13} />
          ) : (
            <Minus size={13} />
          )}
          {task.priority}
        </span>
        {task.due_date && (
          <span
            className={`due-date ${urgency}`}
            title={`${urgency === 'overdue' ? 'Overdue · ' : ''}${task.due_date}`}
          >
            <CalendarDays size={12} />
            {readableDate(task.due_date)}
          </span>
        )}
        <Avatars ids={task.assignee_ids} members={members} />
      </div>
    </article>
  );
}
