#!/bin/bash
# Double-click this file in Finder to commit Phase 3 + Security to GitHub → triggers Vercel deploy
cd "$(dirname "$0")"

echo "🔐 Quorbit Pulse — Phase 3 + Security Commit"
echo "=============================================="
echo ""

# Sync with remote (Phase 2 was committed via API, local may be behind)
echo "⏬ Syncing with remote..."
git fetch origin main 2>&1
git rebase origin/main 2>&1

echo ""
echo "📂 Staging all files..."

# Security layer
git add lib/security/headers.ts
git add lib/security/rate-limit.ts
git add lib/security/sanitize.ts
git add next.config.ts
git add middleware.ts

# Rate limit updates to existing API routes
git add app/api/candidates/import/route.ts
git add "app/api/candidates/[id]/fingerprint/route.ts"
git add app/api/candidates/score-batch/route.ts

# Security page
git add app/security/page.tsx

# Phase 3 — Chat Token System
git add lib/chat/token.ts
git add app/api/candidates/send-chat/route.ts
git add "app/api/chat/[token]/route.ts"
git add "app/chat/[token]/page.tsx"

echo ""
echo "📝 Committing..."
git commit -m "Phase 3 + Security: HMAC chat tokens, rate limiting, sanitization, security page

Security layer (all routes):
- lib/security/headers.ts — CSP, HSTS, X-Frame-Options, Permissions-Policy
- lib/security/rate-limit.ts — sliding-window limiter per company/IP/token
- lib/security/sanitize.ts — HTML strip, URL SSRF guard, prompt injection detect
- next.config.ts — security headers on all routes, narrowed image domains
- middleware.ts — IP rate limit on auth routes, headers on all responses
- import/fingerprint/score-batch routes — per-company rate limits added
- app/security/page.tsx — public /security page documenting all controls

Phase 3 — LLM Chat Validation:
- lib/chat/token.ts — HMAC-SHA256 signed tokens, 7-day TTL, timing-safe verify
- app/api/candidates/send-chat/route.ts — create session, mint token, Resend email
- app/api/chat/[token]/route.ts — public unauthenticated Claude Haiku chat endpoint
- app/chat/[token]/page.tsx — candidate-facing mobile-first chat UI (no login)

DB: migration 005 applied — chat_sessions table with RLS"

echo ""
echo "🚀 Pushing to GitHub (triggers Vercel deploy)..."
git push origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Done! Watch the Vercel deployment at:"
  echo "   https://vercel.com/thequorbit/quorbitpulse/deployments"
  echo ""
  echo "⚠️  Remember to add CHAT_TOKEN_SECRET to Vercel env vars:"
  echo "   https://vercel.com/thequorbit/quorbitpulse/settings/environment-variables"
else
  echo ""
  echo "❌ Push failed. You may need to authenticate."
  echo "   Run: git push origin main"
  echo "   in Terminal from this directory."
fi

echo ""
read -p "Press Enter to close..."
