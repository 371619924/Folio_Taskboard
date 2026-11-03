import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { addDirectoryItem, deleteDirectoryItem } from '../lib/api';
import { errorMessage, initials } from '../lib/board';
import type { Label, Member } from '../lib/types';

const colors = ['#7861dc', '#4587c2', '#4b9f84', '#cd8a60', '#be647c', '#7a8497'];

export function DirectoryDialog({
  kind,
  items,
  onClose,
  onChanged,
  preview,
}: {
  kind: 'members' | 'labels';
  items: (Member | Label)[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  preview: boolean;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(colors[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy || preview) return;
    setBusy(true);
    setError('');
    try {
      await addDirectoryItem(kind, name, color);
      setName('');
      await onChanged();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (busy || preview) return;
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteDirectoryItem(kind, id);
      setConfirmId(null);
      await onChanged();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={kind === 'members' ? 'Team members' : 'Manage labels'}
      onClose={onClose}
      busy={busy}
    >
      <div className="directory-body">
        <p className="field-hint directory-intro">
          {kind === 'members'
            ? 'Organize assignees in your personal workspace. These are names, not invitations or shared accounts.'
            : 'Give your work a little structure. Add labels and filter your board by them.'}
        </p>
        {preview && (
          <p className="preview-note">Sample workspace · Connect Supabase to make changes.</p>
        )}
        <div className="directory-list">
          {items.map((item) => (
            <div className="directory-item" key={item.id}>
              <span
                className={kind === 'members' ? 'avatar' : 'label-swatch'}
                style={{ background: item.color }}
              >
                {kind === 'members' ? initials(item.name) : ''}
              </span>
              <span>{item.name}</span>
              <button
                className="icon-button delete-item"
                onClick={() => void remove(item.id)}
                disabled={busy || preview}
                aria-label={
                  confirmId === item.id ? `Confirm remove ${item.name}` : `Remove ${item.name}`
                }
                title={
                  confirmId === item.id
                    ? 'Click again to confirm; task links will also be removed'
                    : 'Remove'
                }
              >
                {confirmId === item.id ? 'Confirm' : <Trash2 size={15} />}
              </button>
            </div>
          ))}
          {!items.length && (
            <p className="discussion-empty">
              No {kind === 'members' ? 'team members' : 'labels'} yet.
            </p>
          )}
        </div>
        <form className="directory-form" onSubmit={add}>
          <label className="field">
            <span>{kind === 'members' ? 'Member name' : 'Label name'}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === 'members' ? 'e.g. Alex Chen' : 'e.g. Engineering'}
              maxLength={kind === 'members' ? 60 : 40}
              required
              disabled={busy || preview}
            />
          </label>
          <div className="color-options" role="group" aria-label="Choose a color">
            {colors.map((value) => (
              <button
                type="button"
                key={value}
                aria-label={`Color ${value}`}
                aria-pressed={color === value}
                className={`color-option ${color === value ? 'selected' : ''}`}
                style={{ background: value }}
                onClick={() => setColor(value)}
                disabled={busy || preview}
              />
            ))}
          </div>
          <button className="button primary" disabled={busy || preview || !name.trim()}>
            <Plus size={16} />
            {busy ? 'Saving…' : kind === 'members' ? 'Add member' : 'Create label'}
          </button>
        </form>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
