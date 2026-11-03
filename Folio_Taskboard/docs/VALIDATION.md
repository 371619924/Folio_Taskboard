# Validation record

## Completed locally

- Production TypeScript check and Vite build passed.
- 26 automated tests passed across three test files.
- Dependency audit reported zero known vulnerabilities at packaging time.
- Browser inspection covered the setup screen, populated sample board, title search, task detail dialog, and a 390-pixel layout.

The SQL tests run the full schema in embedded PostgreSQL with separate authenticated roles. They exercise all seven RLS boundaries, denied ownership spoofing, cross-user task edits, comments and links, atomic saves, unchanged-link behavior, activity integrity, invalid inputs, unauthenticated access, and cascade deletion.

UI tests cover title search, a failed save that retains the draft, status editing, and recovery from a loading error. Domain tests cover calendar dates, upcoming and completed views, combined filters, and draft defaults.

## Checks that require your accounts

Hosted Supabase Auth and HTTP integration have not been executed because this package contains no project credentials. Run `npm run test:live` after configuring a development project, then test drag-and-drop, refresh persistence, comments, member assignment, and labels in the actual browser app.

No production deployment or GitHub repository is included in this validation. After deploying, open the production URL from a separate browser session and verify isolation before adding the real links to the submission document.
