# JobPulse Setup Guide

## Prerequisites
- Supabase project (create at supabase.com)
- Razorpay account (razorpay.com) — test mode for dev
- Resend account (resend.com)
- Vercel account for deployment

---

## Step 1 — Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required values:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase > Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase > Settings > API
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase > Settings > API (keep secret!)
- `RAZORPAY_KEY_ID` — from Razorpay dashboard
- `RAZORPAY_KEY_SECRET` — from Razorpay dashboard
- `RAZORPAY_WEBHOOK_SECRET` — set when creating webhook in Razorpay
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — same as RAZORPAY_KEY_ID
- `RESEND_API_KEY` — from Resend dashboard
- `NEXT_PUBLIC_APP_URL` — https://jobpulse.io (or your domain)

---

## Step 2 — Set up Supabase database

1. Go to your Supabase project > SQL Editor
2. Paste and run the contents of `supabase/schema.sql`
3. This creates all tables, RLS policies, indexes, and the `increment_job_views` function

---

## Step 3 — Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Step 4 — Set up Razorpay webhook

1. In Razorpay dashboard > Webhooks > Add webhook
2. URL: `https://your-domain.com/api/webhooks/razorpay`
3. Events: `payment.captured`
4. Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`

---

## Step 5 — Deploy to Vercel

```bash
# Push to GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/your-org/jobpulse.git
git push -u origin main
```

1. Go to vercel.com > New Project > Import from GitHub
2. Add all environment variables from `.env.local`
3. Add `CRON_SECRET` (any random string) for the cron job auth
4. Set custom domain (jobpulse.io)

---

## Step 6 — Set up Google Indexing API (optional but recommended)

1. Go to Google Search Console > Add property for your domain
2. Enable the Google Indexing API in Google Cloud Console
3. Create a service account, download JSON key
4. Add the entire JSON as a single-line string to `GOOGLE_INDEXING_SERVICE_ACCOUNT`

---

## Deployment checklist

- [ ] All env vars set in Vercel dashboard
- [ ] Supabase schema applied
- [ ] Razorpay webhook configured
- [ ] Custom domain + SSL on Vercel
- [ ] Test end-to-end: signup → pay → post job → view on board → API returns it → MCP finds it
- [ ] Verify Google Jobs appears (check https://jobs.google.com after 24–48h)

---

## MCP Server

To connect to Claude Desktop:
```json
{
  "mcpServers": {
    "jobpulse": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://jobpulse.io/api/mcp"]
    }
  }
}
```

Test locally with:
```bash
npx @modelcontextprotocol/inspector node mcp/server.js
```

---

## Architecture overview

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database + Auth | Supabase (Postgres + RLS) |
| Styling | Tailwind CSS v4 |
| Payments | Razorpay |
| Email | Resend |
| Deployment | Vercel |
| MCP Server | @modelcontextprotocol/sdk |
| Rich text editor | Tiptap |

---

Powered by [Quorbit](https://quorbit.com)
