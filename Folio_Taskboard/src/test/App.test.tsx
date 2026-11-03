import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import * as api from '../lib/api';
import type { BoardData } from '../lib/types';

vi.mock('../lib/supabase', () => ({
  configurationError: null,
  ensureGuest: vi.fn().mockResolvedValue('guest-a'),
  supabase: null,
}));
vi.mock('../lib/api', () => ({
  loadBoard: vi.fn(),
  saveTask: vi.fn(),
  moveTask: vi.fn(),
  deleteTask: vi.fn(),
  loadDetails: vi.fn(),
  addComment: vi.fn(),
  addDirectoryItem: vi.fn(),
  deleteDirectoryItem: vi.fn(),
}));
const board: BoardData = {
  tasks: [
    {
      id: 'task-a',
      user_id: 'guest-a',
      title: 'Build a board',
      description: 'One step at a time',
      status: 'todo',
      priority: 'high',
      due_date: null,
      created_at: '',
      updated_at: '',
      assignee_ids: [],
      label_ids: [],
    },
  ],
  members: [],
  labels: [],
};

describe('workspace interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.loadBoard).mockResolvedValue(structuredClone(board));
    vi.mocked(api.loadDetails).mockResolvedValue({ comments: [], activity: [] });
  });
  afterEach(cleanup);
  it('loads the board and filters tasks by title', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'Build a board' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search tasks by title' }), {
      target: { value: 'Missing' },
    });
    expect(screen.queryByRole('button', { name: 'Build a board' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(screen.getByRole('button', { name: 'Build a board' })).toBeTruthy();
  });
  it('keeps unsaved input in the dialog when a save fails', async () => {
    vi.mocked(api.saveTask).mockRejectedValue(new Error('Connection lost'));
    render(<App />);
    await screen.findByRole('button', { name: 'Build a board' });
    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Task title/ }), {
      target: { value: 'Keep this draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await screen.findByRole('alert');
    expect((screen.getByRole('textbox', { name: /Task title/ }) as HTMLInputElement).value).toBe(
      'Keep this draft',
    );
    expect(api.saveTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Keep this draft' }),
      null,
    );
  });
  it('saves edited status and closes only after the server accepts it', async () => {
    vi.mocked(api.saveTask).mockResolvedValue('task-a');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Build a board' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
      target: { value: 'done' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.saveTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done' }),
      'task-a',
    );
  });
  it('shows a recoverable loading error', async () => {
    vi.mocked(api.loadBoard).mockRejectedValueOnce(new Error('Database unavailable'));
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain('Database unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Build a board' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
