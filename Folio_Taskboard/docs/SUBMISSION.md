# Folio Task Manager Assessment

Applicant: [YOUR FIRST AND LAST NAME]

Live application: [YOUR PRODUCTION URL]

GitHub repository: [YOUR REPOSITORY URL]

Replace the three fields above before exporting this document. The production URL must open the working Supabase-backed app, not the read-only sample board.

## Solution overview

Folio is a personal Kanban board for managing work through To Do, In Progress, In Review, and Done. A visitor can create a task, add context, assign people, and move it across the board. Each visitor signs in anonymously and sees only their own workspace.

The frontend uses React and TypeScript, with Vite for development and production builds. Supabase provides authentication and PostgreSQL storage. The browser talks directly to Supabase; row level security is the authorization boundary. No separate API server is needed.

## Design decisions

The interface uses a quiet neutral background, white task cards, and a restrained purple accent. Column status dots and label colors help distinguish work without competing with task titles. The summary row shows the overall workload, completed tasks, overdue tasks, and completion percentage.

Task creation and editing use the same dialog. Descriptions, multiple assignees, labels, priority, and due dates sit alongside comments and an activity timeline. Cards show enough information to scan the board while keeping longer context in the detail view.

On narrow screens, navigation moves into a drawer and the board scrolls horizontally. Drag handles keep scrolling and opening a task separate from moving it. Pointer, touch, and keyboard sensors are available, and the status dropdown provides another way to move a task.

Empty columns include a drop target and an add button. The first-use board explains how to create a task. The app includes loading states, offline feedback, retry controls, and a confirmation step before deleting a task. A failed task save leaves the draft in place. Failed drag updates restore the original status.

## Data model and authorization

The database has seven tables. Tasks store the required id, title, status, user_id, and created_at fields, plus description, priority, due_date, and updated_at. Team members and labels belong to the current guest. The task_assignees and task_labels join tables support multiple relationships. Comments store task discussions; task_activity stores the change timeline.

Every table has row level security enabled. Policies require auth.uid() to match user_id. Composite foreign keys include the owner ID, preventing a guest from attaching another guest's member, label, or task to their own records.

The save_task function uses the caller's permissions and saves the task, assignees, and labels in one database transaction. A failed relationship check rolls back the whole save. Triggers write creation, field-change, assignment, and label-change events. Clients can read their activity but cannot forge or delete individual activity events. Deleting a task removes its dependent records.

Only the public Supabase anon key is used in the frontend. Local environment files are excluded from Git. The app never needs a service role key. Comment and description content is rendered as plain text.

## Advanced features

- Team members and assignees: create named members with avatar colors and assign more than one person to a task. These are records inside the guest's private board, not shared accounts or invitations.
- Comments: post text updates inside a task and view them in chronological order with timestamps. Comments are stored separately in Supabase.
- Activity log: review server-recorded status changes, field edits, assignee changes, and label changes.
- Labels: create colored labels, attach multiple labels to a task, and filter by label.
- Due dates: identify overdue tasks and tasks due within the next two days. Completed tasks are excluded from alerts.
- Search and filters: combine a case-insensitive title search with priority, assignee, and label filters. Sidebar views show upcoming work and completed work.
- Board summary: review total tasks, completed tasks, overdue tasks, and completion percentage. Summary counts describe the whole board while column counts reflect the active filters.

## Local setup

1. Install Node.js 22.12 or newer and clone the repository.
2. Run npm ci in the project folder.
3. Create a free Supabase project and run the complete SQL in the appendix once in the SQL Editor.
4. Enable anonymous sign-ins in the project's Authentication settings.
5. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY using the project URL and public anon key.
6. Run npm run dev and open the local URL printed in the terminal.
7. Run npm test for the automated suite and npm run build for the production build.

Without Supabase configuration, the app displays setup instructions. An explicitly labeled sample board is available at /?preview=1. It is read-only and does not replace the real hosted application.

For deployment, import the repository into a free static hosting service. Set the two public environment variables before building, use npm run build, and publish dist. Vercel and Netlify configuration files are included. Vite embeds public configuration at build time, so environment changes require a new build.

## Validation

The automated suite covers title search, combined filters, local calendar due-date behavior, task editing, failure recovery, and the database schema. SQL tests execute the schema in embedded PostgreSQL with separate authenticated guest roles. They verify isolation across all seven tables, denied cross-user writes, atomic saves, link ownership, activity generation, and cascading task deletion.

The separate npm run test:live command checks a configured Supabase project using two anonymous sessions. It verifies the HTTP and Auth integration, persistence, isolation, comments, links, and activity. It requires real project credentials and must be run after setup. The test cleans up its database records; its anonymous Auth users remain until removed in the dashboard.

Before submitting, verify the production URL in two browser sessions, create and move a task, refresh, post a comment, and confirm that one session cannot see the other session's data.

## Tradeoffs and further work

The guest session is tied to browser storage. Clearing that storage or switching browsers creates a different workspace. Account upgrade and recovery would make the board useful over a longer period.

The board saves status changes on drop. It reloads on window focus or explicit refresh rather than subscribing to every database change. This keeps the assessment deployment small; Realtime subscriptions would improve simultaneous use in multiple tabs. Concurrent edits currently use last-write-wins semantics.

Tasks are ordered by creation time within each column. Persistent manual ordering would require an ordering field and a reorder transaction. Search and filters run in the browser, which is suitable for a small personal board. Larger workspaces would need pagination and server-side queries; the current queries use Supabase's configured row limit.

Team members provide assignment metadata, not a multi-user collaboration system. Invitations and shared boards would need a separate membership model and policies. Long-term anonymous-user cleanup, abuse protection with a CAPTCHA flow, and a retention policy would also be appropriate for a broader public launch.

The implementation uses free tiers and has no paid runtime dependencies. Availability and quotas still depend on the chosen hosting and Supabase plans.

## Complete SQL schema

Run this initial migration in a fresh Supabase project. It includes the tables, ownership constraints, indexes, policies, trigger functions, and atomic task-save function.

```sql
begin;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  color text not null default '#7861dc' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  color text not null default '#7861dc' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

-- Composite foreign keys prevent links to another guest's records.
create table public.task_assignees (
  task_id uuid not null,
  member_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (task_id, member_id),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade,
  foreign key (member_id, user_id) references public.team_members(id, user_id) on delete cascade
);

create table public.task_labels (
  task_id uuid not null,
  label_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (task_id, label_id),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade,
  foreign key (label_id, user_id) references public.labels(id, user_id) on delete cascade
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade
);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade
);

create index tasks_owner_created on public.tasks(user_id, created_at desc);
create index members_owner on public.team_members(user_id);
create index labels_owner on public.labels(user_id);
create index assignees_owner on public.task_assignees(user_id);
create index assignees_member on public.task_assignees(member_id);
create index task_labels_owner on public.task_labels(user_id);
create index task_labels_label on public.task_labels(label_id);
create index comments_owner_task_time on public.comments(user_id, task_id, created_at);
create index activity_owner_task_time on public.task_activity(user_id, task_id, created_at);

alter table public.tasks enable row level security;
alter table public.team_members enable row level security;
alter table public.labels enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_labels enable row level security;
alter table public.comments enable row level security;
alter table public.task_activity enable row level security;

create policy own_tasks on public.tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_members on public.team_members for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_labels on public.labels for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_assignments on public.task_assignees for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_task_labels on public.task_labels for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_comments on public.comments for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_activity on public.task_activity for select to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
revoke all on public.tasks, public.team_members, public.labels, public.task_assignees,
  public.task_labels, public.comments, public.task_activity from public, anon, authenticated;
grant select, insert, update, delete on public.tasks, public.team_members, public.labels,
  public.comments to authenticated;
grant select, insert, delete on public.task_assignees, public.task_labels to authenticated;
grant select on public.task_activity to authenticated;

create function public.touch_task() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id then
    raise exception 'Task identity cannot be changed';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch_task before update on public.tasks
  for each row execute function public.touch_task();

create function public.log_task_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changes text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    changes := array['Task created'];
  else
    if new.status is distinct from old.status then
      changes := array_append(changes, 'Moved from ' ||
        case old.status when 'todo' then 'To Do' when 'in_progress' then 'In Progress' when 'in_review' then 'In Review' else 'Done' end || ' → ' ||
        case new.status when 'todo' then 'To Do' when 'in_progress' then 'In Progress' when 'in_review' then 'In Review' else 'Done' end);
    end if;
    if new.title is distinct from old.title then changes := array_append(changes, 'Updated title'); end if;
    if new.description is distinct from old.description then changes := array_append(changes, 'Updated description'); end if;
    if new.priority is distinct from old.priority then changes := array_append(changes, 'Set priority to ' || new.priority); end if;
    if new.due_date is distinct from old.due_date then changes := array_append(changes, 'Updated due date'); end if;
  end if;
  if cardinality(changes) > 0 then
    insert into public.task_activity(task_id, user_id, message)
      values (new.id, new.user_id, array_to_string(changes, ' · '));
  end if;
  return new;
end;
$$;
create trigger log_task_change after insert or update on public.tasks
  for each row execute function public.log_task_change();

create function public.log_task_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_task uuid; owner_id uuid; linked_name text; text_value text;
begin
  if tg_op = 'DELETE' then target_task := old.task_id; owner_id := old.user_id;
  else target_task := new.task_id; owner_id := new.user_id; end if;
  -- A task deletion cascades through its links; there is no surviving history to write.
  if not exists (select 1 from public.tasks where id = target_task and user_id = owner_id) then return null; end if;
  if tg_table_name = 'task_assignees' then
    select name into linked_name from public.team_members where id = case when tg_op = 'DELETE' then old.member_id else new.member_id end;
    text_value := case when tg_op = 'DELETE' then 'Removed assignee ' else 'Assigned ' end || coalesce(linked_name, 'team member');
  else
    select name into linked_name from public.labels where id = case when tg_op = 'DELETE' then old.label_id else new.label_id end;
    text_value := case when tg_op = 'DELETE' then 'Removed label ' else 'Added label ' end || coalesce(linked_name, 'label');
  end if;
  insert into public.task_activity(task_id, user_id, message) values (target_task, owner_id, text_value);
  return null;
end;
$$;
create trigger log_assignee_change after insert or delete on public.task_assignees
  for each row execute function public.log_task_link();
create trigger log_label_change after insert or delete on public.task_labels
  for each row execute function public.log_task_link();

-- Save the task and all links in one transaction. RLS still applies to every statement.
create function public.save_task(
  p_id uuid, p_title text, p_description text, p_status text,
  p_priority text, p_due_date date, p_assignee_ids uuid[], p_label_ids uuid[]
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_task_id uuid; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Sign in before saving a task'; end if;
  if p_id is null then
    insert into public.tasks(user_id, title, description, status, priority, due_date)
      values (owner_id, btrim(p_title), p_description, p_status, p_priority, p_due_date)
      returning id into v_task_id;
  else
    update public.tasks set title = btrim(p_title), description = p_description,
      status = p_status, priority = p_priority, due_date = p_due_date
      where id = p_id and user_id = owner_id returning id into v_task_id;
    if v_task_id is null then raise exception 'Task not found'; end if;
  end if;
  delete from public.task_assignees where task_assignees.task_id = v_task_id
    and not (member_id = any(coalesce(p_assignee_ids, array[]::uuid[])));
  insert into public.task_assignees(task_id, member_id, user_id)
    select v_task_id, member_id, owner_id from (select distinct unnest(p_assignee_ids) as member_id) as requested
    on conflict do nothing;
  delete from public.task_labels where task_labels.task_id = v_task_id
    and not (label_id = any(coalesce(p_label_ids, array[]::uuid[])));
  insert into public.task_labels(task_id, label_id, user_id)
    select v_task_id, label_id, owner_id from (select distinct unnest(p_label_ids) as label_id) as requested
    on conflict do nothing;
  return v_task_id;
end;
$$;

revoke execute on function public.touch_task(), public.log_task_change(), public.log_task_link() from public, anon, authenticated;
revoke execute on function public.save_task(uuid, text, text, text, text, date, uuid[], uuid[]) from public, anon;
grant execute on function public.save_task(uuid, text, text, text, text, date, uuid[], uuid[]) to authenticated;

commit;

```
