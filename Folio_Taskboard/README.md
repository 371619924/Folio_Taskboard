# Folio

A Kanban task board built with React, TypeScript, and Supabase.

## Setup

Requires Node.js 22.12 or newer.

1. Run `npm ci` to install dependencies.
2. Create a Supabase project and run `supabase/schema.sql` once in the SQL Editor.
3. Enable anonymous sign-ins in Supabase Authentication.
4. Copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` — your public anon or publishable key.
5. Run `npm run dev` and open the local URL shown in the terminal.

Never use a service role or secret key in the frontend.

## Features

- Four-column board with drag-and-drop task movement.
- Task creation, editing, deletion, priorities, and due dates.
- Multiple assignees, labels, comments, and activity history.
- Search, filters, due-date indicators, and board statistics.
- Anonymous authentication and user isolation through Supabase RLS.
- Responsive layout with loading, empty, and error states.

## Checks

```bash
npm test
npm run build
```

Run `npm run test:live` after configuring Supabase to check the cloud connection and user isolation.