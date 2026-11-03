import { useEffect, useState, type FormEvent } from 'react';
import { Clock3, MessageSquare, Send, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { blankDraft, errorMessage, taskDraft } from '../lib/board';
import { addComment, loadDetails } from '../lib/api';
import {
  COLUMNS,
  type Activity,
  type BoardData,
  type Comment,
  type Status,
  type Task,
  type TaskDraft,
} from '../lib/types';

export function TaskDialog({
  task,
  initialStatus,
  data,
  preview,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  initialStatus: Status;
  data: BoardData;
  preview: boolean;
  onClose: () => void;
  onSave: (draft: TaskDraft, id: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    task ? taskDraft(task) : blankDraft(initialStatus),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [comment, setComment] = useState('');
  const [details, setDetails] = useState<{ comments: Comment[]; activity: Activity[] }>({
    comments: [],
    activity: [],
  });
  const [detailsLoading, setDetailsLoading] = useState(Boolean(task && !preview));
  const [detailsError, setDetailsError] = useState('');
  const [detailVersion, setDetailVersion] = useState(0);
  const [commentBusy, setCommentBusy] = useState(false);
  useEffect(() => {
    if (!task || preview) return;
    let active = true;
    setDetailsLoading(true);
    setDetailsError('');
    loadDetails(task.id)
      .then((result) => {
        if (active) setDetails(result);
      })
      .catch((error) => {
        if (active) setDetailsError(errorMessage(error));
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [task?.id, preview, detailVersion]);

  function field<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function toggle(key: 'assignee_ids' | 'label_ids', id: string) {
    field(
      key,
      draft[key].includes(id) ? draft[key].filter((item) => item !== id) : [...draft[key], id],
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || preview || !draft.title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSave(draft, task?.id ?? null);
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }
  async function remove() {
    if (!task || preview || busy) return;
    setBusy(true);
    setError('');
    try {
      await onDelete(task.id);
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }
  async function postComment(event: FormEvent) {
    event.preventDefault();
    if (!task || !comment.trim() || commentBusy || preview) return;
    setCommentBusy(true);
    setDetailsError('');
    try {
      await addComment(task.id, comment);
      setComment('');
      setDetailVersion((value) => value + 1);
    } catch (error) {
      setDetailsError(errorMessage(error));
    } finally {
      setCommentBusy(false);
    }
  }
  return (
    <Modal
      title={task ? 'Task details' : 'Create a task'}
      onClose={onClose}
      wide
      busy={busy || commentBusy}
    >
      <div className="modal-scroll">
        {preview && (
          <p className="preview-note">
            Sample task · Connect Supabase to create and save your own work.
          </p>
        )}
        <form id="task-form" onSubmit={submit}>
          <fieldset disabled={busy || preview} className="task-fields">
            <label className="field">
              <span>
                Task title <span className="required">*</span>
              </span>
              <input
                autoComplete="off"
                value={draft.title}
                onChange={(event) => field('title', event.target.value)}
                maxLength={200}
                required
                placeholder="What needs to get done?"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={draft.description}
                onChange={(event) => field('description', event.target.value)}
                rows={3}
                maxLength={10000}
                placeholder="A little context goes a long way…"
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Status</span>
                <select
                  value={draft.status}
                  onChange={(event) => field('status', event.target.value as Status)}
                >
                  {COLUMNS.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Priority</span>
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    field('priority', event.target.value as TaskDraft['priority'])
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="field">
                <span>Due date</span>
                <input
                  type="date"
                  value={draft.due_date}
                  onChange={(event) => field('due_date', event.target.value)}
                />
              </label>
            </div>
            <div className="field">
              <span>Assignees</span>
              <div className="check-options">
                {data.members.map((member) => (
                  <label className="check-chip" key={member.id}>
                    <input
                      type="checkbox"
                      checked={draft.assignee_ids.includes(member.id)}
                      onChange={() => toggle('assignee_ids', member.id)}
                    />
                    <span className="small-dot" style={{ background: member.color }} />
                    {member.name}
                  </label>
                ))}
                {!data.members.length && (
                  <p className="field-hint">Add people using “Team members” in the sidebar.</p>
                )}
              </div>
            </div>
            <div className="field">
              <span>Labels</span>
              <div className="check-options">
                {data.labels.map((label) => (
                  <label className="check-chip" key={label.id}>
                    <input
                      type="checkbox"
                      checked={draft.label_ids.includes(label.id)}
                      onChange={() => toggle('label_ids', label.id)}
                    />
                    <span className="small-dot" style={{ background: label.color }} />
                    {label.name}
                  </label>
                ))}
                {!data.labels.length && (
                  <p className="field-hint">Create labels using “Manage labels” in the sidebar.</p>
                )}
              </div>
            </div>
          </fieldset>
        </form>
        {task && (
          <section className="discussion">
            <div className="discussion-tabs" role="tablist" aria-label="Task discussion">
              <button
                role="tab"
                aria-selected={tab === 'comments'}
                className={tab === 'comments' ? 'selected' : ''}
                onClick={() => setTab('comments')}
              >
                <MessageSquare size={15} />
                Comments <span>{details.comments.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={tab === 'activity'}
                className={tab === 'activity' ? 'selected' : ''}
                onClick={() => setTab('activity')}
              >
                <Clock3 size={15} />
                Activity
              </button>
            </div>
            {detailsLoading && (
              <p className="field-hint" role="status">
                Loading task history…
              </p>
            )}
            {detailsError && (
              <div className="inline-error" role="alert">
                {detailsError}
                <button type="button" onClick={() => setDetailVersion((value) => value + 1)}>
                  Retry
                </button>
              </div>
            )}
            <div role="tabpanel" aria-label={tab === 'comments' ? 'Comments' : 'Activity'}>
              {tab === 'comments' ? (
                <>
                  {!detailsLoading && !details.comments.length && (
                    <p className="discussion-empty">
                      No comments yet. Keep the conversation close to the work.
                    </p>
                  )}
                  {details.comments.map((item) => (
                    <article className="comment" key={item.id}>
                      <div className="comment-meta">
                        <strong>You</strong>
                        <time dateTime={item.created_at}>
                          {new Date(item.created_at).toLocaleString()}
                        </time>
                      </div>
                      <p>{item.body}</p>
                    </article>
                  ))}
                  <form className="comment-form" onSubmit={postComment}>
                    <label className="sr-only" htmlFor="comment-body">
                      Write a comment
                    </label>
                    <textarea
                      id="comment-body"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Leave a thoughtful update…"
                      maxLength={4000}
                      rows={2}
                      disabled={preview || commentBusy || busy}
                    />
                    <button
                      className="button secondary"
                      disabled={preview || commentBusy || busy || !comment.trim()}
                    >
                      <Send size={14} />
                      {commentBusy ? 'Posting…' : 'Post comment'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="activity-list">
                  {!detailsLoading && !details.activity.length && (
                    <p className="discussion-empty">Task changes will appear here.</p>
                  )}
                  {details.activity.map((item) => (
                    <div className="activity-item" key={item.id}>
                      <span className="activity-dot" />
                      <div>
                        <p>{item.message}</p>
                        <time dateTime={item.created_at}>
                          {new Date(item.created_at).toLocaleString()}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <footer className="modal-footer">
        {error && (
          <div className="inline-error full-width" role="alert">
            {error}
          </div>
        )}
        {task && !preview && (
          <button
            className="button danger subtle"
            type="button"
            disabled={busy || commentBusy}
            onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
          >
            <Trash2 size={15} />
            {confirmDelete ? 'Confirm delete' : 'Delete task'}
          </button>
        )}
        <div className="footer-actions">
          <button className="button secondary" onClick={onClose} disabled={busy || commentBusy}>
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            form="task-form"
            disabled={busy || commentBusy || preview || !draft.title.trim()}
          >
            {busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </footer>
    </Modal>
  );
}
