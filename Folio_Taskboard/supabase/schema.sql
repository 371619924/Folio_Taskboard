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
