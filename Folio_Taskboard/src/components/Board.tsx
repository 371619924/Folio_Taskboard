import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { COLUMNS, type BoardData, type Status, type Task } from '../lib/types';
import { TaskCard } from './TaskCard';

const columnKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) return undefined;
  event.preventDefault();
  const current = context.over?.id ?? context.active?.data.current?.status;
  let index = COLUMNS.findIndex((column) => column.id === current);
  if (index < 0) index = 0;
  const direction = event.code === 'ArrowRight' || event.code === 'ArrowDown' ? 1 : -1;
  const target = COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, index + direction))];
  const rect = context.droppableRects.get(target.id);
  if (!rect || !context.collisionRect) return currentCoordinates;
  return {
    x:
      currentCoordinates.x +
      rect.left +
      rect.width / 2 -
      (context.collisionRect.left + context.collisionRect.width / 2),
    y: currentCoordinates.y,
  };
};

function Column({
  column,
  tasks,
  members,
  labels,
  onOpen,
  onAdd,
  disabled,
}: {
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  members: BoardData['members'];
  labels: BoardData['labels'];
  onOpen: (task: Task) => void;
  onAdd: (status: Status) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? 'drop-target' : ''}`}
      aria-label={`${column.title} column`}
    >
      <div className="column-heading">
        <span className="column-dot" style={{ background: column.color }} />
        <h2>{column.title}</h2>
        <span className="count">{tasks.length}</span>
        <button
          className="icon-button column-add"
          disabled={disabled}
          aria-label={`Add task to ${column.title}`}
          onClick={() => onAdd(column.id)}
        >
          <Plus size={17} />
        </button>
      </div>
      <div className="column-cards">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            labels={labels}
            onOpen={onOpen}
            disabled={disabled}
          />
        ))}
        {!tasks.length && (
          <div className="column-empty">
            <span className="empty-dashes" />
            <p>Room for what’s next</p>
            <span>Add a task or drop one here.</span>
          </div>
        )}
      </div>
      <button className="add-in-column" disabled={disabled} onClick={() => onAdd(column.id)}>
        <Plus size={15} />
        Add task
      </button>
    </section>
  );
}

export function Board({
  data,
  tasks,
  onOpen,
  onAdd,
  onMove,
  disabled,
}: {
  data: BoardData;
  tasks: Task[];
  onOpen: (task: Task) => void;
  onAdd: (status: Status) => void;
  onMove: (id: string, status: Status) => void;
  disabled: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );
  function dragEnd(event: DragEndEvent) {
    const status = event.over?.id;
    if (COLUMNS.some((column) => column.id === status))
      onMove(String(event.active.id), status as Status);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <div className="board">
        {COLUMNS.map((column) => (
          <Column
            key={column.id}
            column={column}
            tasks={tasks.filter((task) => task.status === column.id)}
            members={data.members}
            labels={data.labels}
            onOpen={onOpen}
            onAdd={onAdd}
            disabled={disabled}
          />
        ))}
      </div>
    </DndContext>
  );
}
