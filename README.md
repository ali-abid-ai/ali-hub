# ALI HUB — Complete Cloud Workspace

This is a complete Vite + React project based on the ALI HUB module package. It adds the missing project shell, Books module, Supabase authentication, PostgreSQL-backed records, private document storage, responsive styling, and local-data migration.

## Stack
- React + Vite
- Supabase Auth
- Supabase PostgreSQL + Row Level Security
- Supabase private Storage
- lucide-react icons

## Setup

1. Install Node.js LTS if it is not already installed.
2. Open this project folder in VS Code.
3. In the VS Code terminal run:

   ```bash
   npm install
   ```

4. Create a Supabase project at https://supabase.com.
5. In Supabase → SQL Editor, run the complete `supabase/setup.sql` file.
6. In the Supabase project settings, copy the Project URL and anon/publishable key.
7. Copy `.env.example` to a new file named `.env` in the project root and fill in:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
   ```

   Never use the service-role key in a browser app. Never commit `.env` to GitHub.

8. Start the app:

   ```bash
   npm run dev
   ```

9. Create an account from the ALI HUB sign-up screen. If email confirmation is enabled in Supabase, confirm your email before signing in.

## Existing local data migration
After the first successful sign-in, ALI HUB checks the browser's previous `ali-hub-data` localStorage object and imports its books, knowledge, quizzes, assignments, websites, repositories, documents and projects into the signed-in cloud account. Migration is marked per user in localStorage after a successful import. Keep an exported JSON backup before switching. The previous Books module's exact source was not included in the uploaded ZIP, so this project supplies a replacement cloud-backed Books module.

## Included modules
Dashboard, My Books, Knowledge Vault, Quizzes, Assignments, My Websites, Repositories, Documents (real private file upload/download), My Projects, Tasks and Calendar record managers, account sign-out, light/dark theme, cloud backup export.

## Important implementation notes
- Records are stored in `public.records`; Row Level Security limits access to the authenticated owner.
- Documents are stored in the private `ali-hub-documents` bucket with per-user folder policies.
- Tasks and Calendar have separate cloud-backed record sections. Automatic push/email reminder delivery is not included in this first cloud build.
- AI Assistant is not enabled in this build. A secure server-side/Edge Function integration is required; do not expose an AI provider secret in frontend variables.
- Cloud backup export is included. Restore/import UI is not included in this first cloud build.
- A live deployment requires the user's Supabase project credentials and a GitHub/Vercel account action.

## Build check
Run `npm run build` before deploying.
