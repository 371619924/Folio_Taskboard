# Folio

A personal Kanban workspace built with React, TypeScript, and Supabase. Tasks move through To Do, In Progress, In Review, and Done. Each visitor gets an anonymous account and a private board.

## Run locally

Requires Node.js 22.12 or newer and a free Supabase project.

1. Open `Folio.code-workspace` in VS Code.
2. In the terminal, run `npm ci`.
3. In the Supabase SQL Editor, run the entire `supabase/schema.sql` file once in a **new project**. The script is an initial migration, not an idempotent seed script.
4. Enable anonymous sign-ins in Supabase Authentication settings.
5. Copy `.env.example` to `.env.local` and fill in the project URL and **public anon key** from Supabase project settings. Never use the service role key.
6. Run `npm run dev` and open the local URL shown in the terminal.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Without configuration, the app shows setup instructions. The sample board at `/?preview=1` is explicitly read-only and makes no database requests. The real board starts empty and persists all records in Supabase.

## Features

- Pointer, touch, and keyboard drag-and-drop between four columns.
- Create, edit, and delete tasks; set priority, descriptions, and due dates.
- Multiple assignees with colored avatars and custom labels.
- Task comments in chronological order and a server-recorded activity timeline.
- Overdue and upcoming date indicators, title search, and combined filters.
- Total, completed, overdue, and progress statistics.
- Loading, empty, offline, and recoverable error states.
- Responsive navigation and horizontally scrollable columns on smaller screens.

To move a task using a keyboard, focus its drag handle, press Space, use the arrow keys, and press Space again. Escape cancels the drag. The status dropdown in task details offers another way to move a task.

## Data and security

`supabase/schema.sql` contains every table, index, policy, trigger, and the `save_task` function. All seven public tables have RLS enabled. Anonymous sign-in produces an authenticated Supabase user; policies compare `auth.uid()` to each record's `user_id`.

Composite foreign keys enforce ownership across tasks, assignees, labels, comments, and activity. The save function runs as the caller and commits the task and its links atomically. Activity is written by narrowly scoped database triggers; browser clients can only read it.

The public anon key belongs in the frontend. It does not bypass RLS. Local environment files are ignored by Git. React renders comments and descriptions as text, not HTML.

Guest sessions are remembered in this browser. Clearing site storage, changing browsers, or using a separate private browsing session starts a different workspace. Team members are task assignee records inside the current guest's board; they are not invitations or shared user accounts.

## Validate

```bash
npm test
npm run build
```

The tests run UI scenarios and the actual SQL schema in an embedded PostgreSQL engine, including separate authenticated roles and denied cross-user reads and writes. They do not require a cloud account.

After configuring Supabase, run the separate integration check:

```bash
npm run test:live
```

This signs in two temporary anonymous users and verifies the deployed database. Test records are removed afterward; the two anonymous Auth users remain and can be removed in the dashboard. Use this on a development project. The hosted Supabase Auth and HTTP integration cannot be verified without your project configuration.

## Deploy and submit

See `docs/DEPLOYMENT.md` for Vercel, Netlify, or Cloudflare Pages setup. All use the free tier. The project contains deployment configuration for Vercel and Netlify.

`docs/firstname_lastname_task_manager_assessment.docx` is the editable Word submission draft. `docs/SUBMISSION.md` contains the same content in Markdown. Both contain design decisions, setup steps, tradeoffs, advanced features, and the complete SQL schema. Add your name, live URL, and GitHub URL, review it, then export a PDF or Word document named `firstname_lastname_task_manager_assessment.pdf` or `.docx`. Upload that document to Google Drive and share its link using the assessment form.

Keep the original assessment PDF out of this repository. Do not publicly post the final submission link. A GitHub repository can be public or private as allowed by the assessment.
