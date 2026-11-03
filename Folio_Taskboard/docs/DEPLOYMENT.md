# Deployment

The source is ready for a static host. A live submission still requires a configured Supabase project, a GitHub repository, and a deployment in your hosting account.

## Supabase

1. Create a free project and wait for it to become ready.
2. Open SQL Editor, paste all of `supabase/schema.sql`, and run it once. Use a fresh project; do not disable RLS if a query fails.
3. Open Authentication settings and enable anonymous sign-ins.
4. Copy the project URL and legacy public **anon** key from the project settings. The public publishable key is also accepted by the client. Do not use any secret or service role key.
5. Put the two values into `.env.local`. Restart Vite after changing them.
6. Run `npm run test:live`, then test the app in a regular window and a private window. Each should have a different board. Closing and reopening a private window may destroy its anonymous session.

No email provider, paid database, Realtime publication, custom server, or redirect URL is required for this anonymous flow. Status changes are saved on drop. Other tabs pick up current data on focus or with Refresh.

If Supabase reports anonymous sign-ins are disabled, check the Authentication setting. If it reports a rate limit, wait for the project's documented reset period; do not repeatedly create sessions. If CAPTCHA protection is enabled, the sign-in flow needs a CAPTCHA widget and token before it can be used; the included flow assumes anonymous sign-in without an additional challenge. Do not disable an existing protection on a shared project just to run this app; use a separate assessment project.

## GitHub

Create a new repository, then run from the project folder:

```bash
git init
git add .
git commit -m "Build task board workspace"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace the repository URL with the actual one. The included `.gitignore` excludes environment files, dependencies, build output, and local machine files. Inspect `git status` before committing. Do not add the assessment PDF.

The assessment accepts a public repository or a private repository link and says no collaborator invitation is necessary. A private link is normally accessible only to authorized GitHub accounts, so confirm the recipient can actually review it through the submission process. A public code repository is the simplest access option if you are comfortable publishing the implementation. Never publish the assessment PDF or final submission document link.

## Vercel

1. Import the GitHub repository using Vercel's free tier.
2. Select Vite as the framework. Build: `npm run build`. Output: `dist`. Install: `npm ci`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the production environment.
4. Deploy. Vite embeds these public values during the build; redeploy after changing them.
5. Open the production URL in a private window, create a task, move it, and refresh. The default URL must show the real board, without `?preview=1`.
6. Copy the production URL into the submission document.

## Netlify

Import the GitHub repository. The included `netlify.toml` selects `npm run build`, the `dist` directory, and Node 22. Add the same two environment variables before deploying. Redeploy after changing them.

## Cloudflare Pages

Connect the repository, select a Vite static build, use `npm run build` and output directory `dist`, and select Node 22.12 or newer. Add the two public environment variables before building. A Worker is not needed.

## Before submitting

- Open the public production URL from a signed-out/private browser window; it must not require your hosting login.
- Confirm the default route loads the real app, not setup instructions or sample preview.
- Create, edit, drag, comment, assign a member, add a label, and refresh to check persistence.
- Confirm another browser session cannot see those records.
- Test a narrow screen and keyboard navigation.
- Make sure the GitHub link can be reviewed and contains the full source and schema.
- Fill the three marked fields in `docs/SUBMISSION.md`, export to PDF or DOCX, and rename using your first and last name.
- Upload only the final document to Google Drive and set its access according to the form's instructions.

No deployment URL or repository URL is prefilled because these accounts have not been configured in the source package.
