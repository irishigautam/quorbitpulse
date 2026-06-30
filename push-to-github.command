#!/bin/bash
# Double-click this file in Finder to push to GitHub → triggers Vercel deploy
cd "$(dirname "$0")"

# ── PASTE YOUR GITHUB PAT HERE ──────────────────────────────────────────────
# Classic token with 'repo' scope: github.com/settings/tokens/new
GITHUB_TOKEN="PASTE_YOUR_TOKEN_HERE"
# ────────────────────────────────────────────────────────────────────────────

echo "📦 Quorbit — Pushing to GitHub"
echo "================================"

if [ "$GITHUB_TOKEN" = PASTE_YOUR_TOKEN_HERE ]; then
  echo "❌ No token set. Edit this file and paste your GitHub PAT."
  echo "   Get one at: https://github.com/settings/tokens/new"
  echo "   Select: Classic token → check 'repo' scope"
  read -p "Press Enter to close..."
  exit 1
fi

# Set remote with token embedded (no password prompt)
git remote set-url origin "https://irishigautam:${GITHUB_TOKEN}@github.com/irishigautam/quorbit.git"
echo "✓ Remote configured"

echo ""
echo "Pushing to main..."
git push -u origin main

# Remove token from remote URL after push (security)
git remote set-url origin "https://irishigautam@github.com/irishigautam/quorbit.git"

echo ""
echo "✅ Done! Vercel will deploy automatically."
echo "   Watch: https://vercel.com/thequorbit/quorbit/deployments"
echo ""
read -p "Press Enter to close..."
