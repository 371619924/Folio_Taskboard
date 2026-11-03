import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Columns3,
  FolderKanban,
  LayoutGrid,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { Board } from './components/Board';
import { DirectoryDialog } from './components/DirectoryDialog';
import { TaskDialog } from './components/TaskDialog';
import { Avatars } from './components/TaskCard';
import * as api from './lib/api';
import { dueState, errorMessage, filterTasks } from './lib/board';
import { sampleBoard } from './lib/sample';
import { configurationError, ensureGuest, supabase } from './lib/supabase';
import type { BoardData, Filters, Status, Task, TaskDraft } from './lib/types';

const emptyBoard: BoardData = { tasks: [], members: [], labels: [] };
const initialFilters: Filters = { query: '', priority: '', assignee: '', label: '', view: 'all' };
const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';

function Configuration() {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <span className="brand-mark large">f</span>
        <p className="eyebrow">A LITTLE SPACE FOR YOUR NEXT BIG THING</p>
        <h1>
          Make room for
          <br />
          good work.
        </h1>
        <p>
          Connect your workspace to start organizing tasks, sharing context, and moving things
          forward.
        </p>
        <div className="setup-steps">
          <strong>Connect Supabase</strong>
          <ol>
            <li>
              Run <code>supabase/schema.sql</code> in the SQL Editor.
            </li>
            <li>Enable anonymous sign-ins under Authentication.</li>
            <li>
              Copy <code>.env.example</code> to <code>.env.local</code> and add your project URL and
              public anon key.
            </li>
            <li>
              Restart with <code>npm run dev</code>.
            </li>
          </ol>
        </div>
        <p className="field-hint">{configurationError}</p>
        <a className="button primary" href="?preview=1">
          Explore a sample board <ArrowRight size={16} />
        </a>
        <span className="setup-footnote">
          Sample data is read-only. Your real workspace starts empty.
        </span>
      </div>
      <div className="setup-art" aria-hidden="true">
        <span className="art-circle" />
        <div className="art-note one">
          <span className="art-tag">Make a plan</span>
          <strong>
            Small steps.
            <br />
            Meaningful progress.
          </strong>
          <span className="art-line" />
          <span className="art-line short" />
        </div>
        <div className="art-note two">
          <span className="art-check">✓</span>
          <strong>One thing at a time.</strong>
          <span className="art-line" />
        </div>
        <span className="art-caption">A clearer view of what’s next.</span>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<BoardData>(() => (isPreview ? sampleBoard() : emptyBoard));
  const [loading, setLoading] = useState(!isPreview);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const request = useRef(0);
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [dialog, setDialog] = useState<{ task: Task | null; status: Status } | null>(null);
  const [directory, setDirectory] = useState<'members' | 'labels' | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [todayTick, setTodayTick] = useState(0);

  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    const result = await api.loadBoard();
    if (sequence === request.current) setData(result);
  }, []);
  const initialize = useCallback(async () => {
    if (isPreview || configurationError) return;
    setLoading(true);
    setError('');
    try {
      const id = await ensureGuest();
      setUserId(id);
      await refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    function connectivity() {
      setOnline(navigator.onLine);
    }
    function focus() {
      setTodayTick((value) => value + 1);
      if (!isPreview && userId && !busyRef.current)
        void refresh().catch((error) => setError(errorMessage(error)));
    }
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('online', connectivity);
      window.removeEventListener('offline', connectivity);
      window.removeEventListener('focus', focus);
    };
  }, [refresh, userId]);
  useEffect(() => {
    if (isPreview || !supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setUserId(session.user.id);
      if (event === 'SIGNED_OUT') {
        setData(emptyBoard);
        setUserId('');
        setError('Your guest session ended. Reload to start a new workspace.');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visible = useMemo(() => filterTasks(data.tasks, filters), [data.tasks, filters, todayTick]);
  const completed = data.tasks.filter((task) => task.status === 'done').length;
  const overdue = data.tasks.filter(
    (task) => dueState(task.due_date, task.status) === 'overdue',
  ).length;
  const progress = data.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0;
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeDirectory = useCallback(() => setDirectory(null), []);
  function filter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function navigate(view: Filters['view']) {
    setFilters({ ...initialFilters, view });
    setSidebar(false);
  }
  function beginMutation() {
    if (busyRef.current) throw new Error('Please wait for the current change to finish.');
    busyRef.current = true;
    setBusy(true);
    ++request.current;
  }
  function endMutation() {
    busyRef.current = false;
    setBusy(false);
  }
  async function refreshAfterSave(message: string) {
    try {
      await refresh();
      setError('');
      setNotice(message);
    } catch {
      setError(
        'Your change was saved, but the board could not refresh. Use Refresh to load the latest data.',
      );
    }
  }
  async function save(draft: TaskDraft, id: string | null) {
    beginMutation();
    try {
      await api.saveTask(draft, id);
      await refreshAfterSave(id ? 'Task updated' : 'Task created');
      setDialog(null);
    } finally {
      endMutation();
    }
  }
  async function remove(id: string) {
    beginMutation();
    try {
      await api.deleteTask(id);
      setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
      await refreshAfterSave('Task deleted');
      setDialog(null);
    } finally {
      endMutation();
    }
  }
  async function move(id: string, status: Status) {
    const task = data.tasks.find((item) => item.id === id);
    if (!task || task.status === status || busyRef.current || isPreview) return;
    beginMutation();
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === id ? { ...item, status } : item)),
    }));
    try {
      await api.moveTask(id, status);
      setError('');
      setNotice('Task moved');
    } catch (error) {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((item) => (item.id === id ? task : item)),
      }));
      setError(`Task could not be moved. ${errorMessage(error)}`);
    } finally {
      endMutation();
    }
  }
  async function manualRefresh() {
    setRefreshing(true);
    try {
      await refresh();
      setError('');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }

  if (configurationError && !isPreview) return <Configuration />;
  const disabled = isPreview || busy || loading || !online || !userId;
  return (
    <div className="app-shell">
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <a className="brand" href={isPreview ? '?preview=1' : '/'}>
          <span className="brand-mark">f</span>
          <span>
            folio<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-icon">W</span>
          <div>
            <strong>My workspace</strong>
            <span>Personal space</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${filters.view === 'all' && !filters.label ? 'active' : ''}`}
            onClick={() => navigate('all')}
          >
            <LayoutGrid size={18} />
            Overview<span className="nav-count">{data.tasks.length}</span>
          </button>
          <button
            className={`nav-item ${filters.view === 'due' ? 'active' : ''}`}
            onClick={() => navigate('due')}
          >
            <CalendarDays size={18} />
            Due soon
          </button>
          <button
            className={`nav-item ${filters.view === 'completed' ? 'active' : ''}`}
            onClick={() => navigate('completed')}
          >
            <CheckCheck size={18} />
            Completed<span className="nav-count">{completed}</span>
          </button>
          <button
            className="nav-item"
            disabled={loading}
            onClick={() => {
              setDirectory('members');
              setSidebar(false);
            }}
          >
            <Users size={18} />
            Team members
          </button>
        </nav>
        <div className="nav-section-heading">
          <p className="nav-label">YOUR LABELS</p>
          <button
            className="icon-button"
            aria-label="Manage labels"
            onClick={() => {
              setDirectory('labels');
              setSidebar(false);
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="label-nav" aria-label="Labels">
          {data.labels.map((label) => (
            <button
              key={label.id}
              className={`nav-item ${filters.label === label.id ? 'active' : ''}`}
              onClick={() => {
                filter('label', filters.label === label.id ? '' : label.id);
                setSidebar(false);
              }}
            >
              <span className="small-dot" style={{ background: label.color }} />
              {label.name}
            </button>
          ))}
          {!data.labels.length && (
            <button className="empty-labels" onClick={() => setDirectory('labels')}>
              + Create your first label
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-tip">
            <span className="tip-icon">
              <FolderKanban size={20} />
            </span>
            <strong>A little more clarity.</strong>
            <p>
              One place for your tasks.
              <br />
              More space for your ideas.
            </p>
            <span className="tip-decoration" />
          </div>
          <div className="guest-profile">
            <span className="guest-avatar">G</span>
            <div>
              <strong>Guest workspace</strong>
              <span>
                <span className="status-dot" />
                {isPreview ? 'Sample preview' : online ? 'Private & secure' : 'Offline'}
              </span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebar(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>Task board</strong>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <ShieldCheck size={13} />
              Private board
            </span>
            <a
              href="https://supabase.com/docs/guides/auth/auth-anonymous"
              target="_blank"
              rel="noreferrer"
              className="icon-button"
              aria-label="About guest accounts"
            >
              <CircleHelp size={18} />
            </a>
            <span className="top-avatar">G</span>
          </div>
        </header>
        {isPreview && (
          <div className="preview-banner">
            <span>
              Sample preview · Changes are disabled. Connect Supabase to use your own board.
            </span>
            <a href="/">
              Set up workspace <ArrowUpRight size={13} />
            </a>
          </div>
        )}
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            You’re offline. Your board is still here; reconnect to save changes.
          </div>
        )}
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span className="small-dot" />
                LET’S MAKE THINGS HAPPEN
              </div>
              <h1>
                {filters.view === 'due'
                  ? 'Coming up.'
                  : filters.view === 'completed'
                    ? 'Good work, done.'
                    : 'A clearer view of work.'}
              </h1>
              <p>
                {filters.view === 'due'
                  ? 'Overdue tasks and the next two days, all in one place.'
                  : filters.view === 'completed'
                    ? 'A little space to appreciate your progress.'
                    : 'Big ideas, small steps. Keep everything moving.'}
              </p>
            </div>
            <button
              className="button primary new-task-button"
              onClick={() => setDialog({ task: null, status: 'todo' })}
              disabled={disabled}
            >
              <Plus size={17} />
              New task
            </button>
          </div>
          <section className="summary-grid" aria-label="Board summary">
            <div className="summary-card">
              <span className="summary-icon lavender">
                <FolderKanban size={18} />
              </span>
              <div>
                <span>Total tasks</span>
                <strong>{data.tasks.length.toString().padStart(2, '0')}</strong>
              </div>
              <span className="summary-detail">Across your board</span>
            </div>
            <div className="summary-card">
              <span className="summary-icon mint">
                <CheckCheck size={18} />
              </span>
              <div>
                <span>Completed</span>
                <strong>{completed.toString().padStart(2, '0')}</strong>
              </div>
              <span className="summary-detail">A step forward</span>
            </div>
            <div className="summary-card">
              <span className="summary-icon peach">
                <CalendarDays size={18} />
              </span>
              <div>
                <span>Overdue</span>
                <strong>{overdue.toString().padStart(2, '0')}</strong>
              </div>
              <span className="summary-detail">Needs a little love</span>
            </div>
            <div className="summary-card progress-summary">
              <div
                className="progress-ring"
                style={{ background: `conic-gradient(#7861dc ${progress}%, #edeaf7 0)` }}
              >
                <span>{progress}%</span>
              </div>
              <div>
                <span>Board progress</span>
                <strong className="progress-copy">
                  {progress === 100 ? 'All wrapped up' : 'Keep it going'}
                </strong>
              </div>
            </div>
          </section>
          <section className="board-section" aria-label="Task board">
            <div className="board-tabs">
              <div className="board-tab">
                <Columns3 size={16} />
                Board view
                <span className="tab-dot" />
              </div>
              <div className="board-collaborators">
                <Avatars ids={data.members.map((item) => item.id)} members={data.members} />
                <button
                  className="add-member"
                  aria-label="Manage team members"
                  onClick={() => setDirectory('members')}
                >
                  <Plus size={13} />
                </button>
                <span>
                  {data.members.length} {data.members.length === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
            <div className="board-toolbar">
              <label className="search-box">
                <Search size={16} />
                <span className="sr-only">Search tasks by title</span>
                <input
                  placeholder="Search tasks…"
                  value={filters.query}
                  onChange={(event) => filter('query', event.target.value)}
                />
                <span className="search-hint" aria-hidden="true">
                  ⌕
                </span>
              </label>
              <div className="filter-controls">
                <span className="filter-icon">
                  <SlidersHorizontal size={15} />
                </span>
                <select
                  aria-label="Filter by priority"
                  value={filters.priority}
                  onChange={(event) => filter('priority', event.target.value)}
                >
                  <option value="">All priorities</option>
                  <option value="high">High priority</option>
                  <option value="normal">Normal priority</option>
                  <option value="low">Low priority</option>
                </select>
                <select
                  aria-label="Filter by assignee"
                  value={filters.assignee}
                  onChange={(event) => filter('assignee', event.target.value)}
                >
                  <option value="">All assignees</option>
                  {data.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by label"
                  value={filters.label}
                  onChange={(event) => filter('label', event.target.value)}
                >
                  <option value="">All labels</option>
                  {data.labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </select>
                <button
                  className={`icon-button ${refreshing ? 'spinning' : ''}`}
                  aria-label="Refresh board"
                  onClick={() => void manualRefresh()}
                  disabled={isPreview || busy || loading || refreshing || !online || !userId}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            {(filters.query || filters.priority || filters.assignee || filters.label) && (
              <div className="filter-summary">
                <Tag size={13} />
                Showing {visible.length} of {data.tasks.length} tasks
                <button
                  onClick={() =>
                    setFilters((current) => ({ ...initialFilters, view: current.view }))
                  }
                >
                  Clear filters <X size={12} />
                </button>
              </div>
            )}
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button
                  onClick={() => void (userId ? manualRefresh() : initialize())}
                  disabled={busy || refreshing || loading}
                >
                  Retry
                </button>
              </div>
            )}
            {loading ? (
              <div className="loading-board" role="status">
                <LoaderCircle size={24} className="spinning" />
                <h2>Making space for your work…</h2>
                <p>Signing in securely and loading your board.</p>
              </div>
            ) : (
              <>
                {!data.tasks.length && !error && (
                  <div className="welcome-strip">
                    <span className="welcome-icon">
                      <FolderKanban size={24} />
                    </span>
                    <div>
                      <strong>Your next good idea starts here.</strong>
                      <p>
                        Create your first task. Move it across the board as your work takes shape.
                      </p>
                    </div>
                    <ArrowRight size={22} />
                  </div>
                )}
                <Board
                  data={data}
                  tasks={visible}
                  onOpen={(task) => setDialog({ task, status: task.status })}
                  onAdd={(status) => setDialog({ task: null, status })}
                  onMove={(id, status) => void move(id, status)}
                  disabled={disabled}
                />
              </>
            )}
            <div className="board-footnote">
              <span>
                <ShieldCheck size={13} />
                Only you can access the tasks in this guest workspace.
              </span>
              <span>Drag to move · Open a task to edit</span>
            </div>
          </section>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCheck size={16} />
          {notice}
        </div>
      )}
      {dialog && (
        <TaskDialog
          key={dialog.task?.id ?? 'new'}
          task={dialog.task}
          initialStatus={dialog.status}
          data={data}
          preview={isPreview}
          onClose={closeDialog}
          onSave={save}
          onDelete={remove}
        />
      )}
      {directory && (
        <DirectoryDialog
          kind={directory}
          items={directory === 'members' ? data.members : data.labels}
          onClose={closeDirectory}
          onChanged={refresh}
          preview={isPreview}
        />
      )}
    </div>
  );
}
