---
name: deploy
description: 'Deploy TSP-V2 to Netlify. Use when: deploying to production, pre-deploy checklist, setting up env variables, configuring Netlify, checking build output, netlify.toml, PWA deploy, publish new version.'
argument-hint: 'Optional: "check" for pre-deploy checks only, "env" for env variable setup'
---

# Deploy — TSP-V2

Pre-deploy checklist and deployment workflow for TSP-V2 → Netlify.

## When to Use
- Before pushing to production branch
- Configuring Netlify environment variables
- Investigating a failed Netlify build
- Setting up the project on a new Netlify site

## Pre-Deploy Checklist

### Step 1 — QA Pass
Run the full QA pipeline (see [qa-check skill](../qa-check/SKILL.md)):
```powershell
npx tsc --noEmit ; npm run lint ; npm test ; npm run build:check
```
All must pass with **0 errors** before deploying.

### Step 2 — Environment Variables
Verify `.env.local` exists locally and all variables are configured in **Netlify → Site settings → Environment variables**:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

Rules:
- Variables must start with `VITE_` to be accessible in the browser
- Never commit `.env.local` to git — it's in `.gitignore`
- Never hardcode secrets in source code

### Step 3 — Production Build Locally
```powershell
npm run build
```
Check `dist/` folder was created successfully. Preview it:
```powershell
npm run preview
```
Open `http://localhost:4173` and verify:
- [ ] Login page loads
- [ ] No console errors on startup
- [ ] App routing works (navigate to `/customers`)
- [ ] PWA install prompt appears

### Step 4 — Deploy

**Auto-deploy (recommended):** Push to the connected git branch (usually `main` or `master`).
```powershell
git push origin main
```

**Manual deploy via Netlify CLI:**
```powershell
npx netlify deploy --prod --dir=dist
```

## Netlify Configuration (`netlify.toml`)

Key settings already configured in the project:

| Setting | Value | Purpose |
|---------|-------|---------|
| Build command | `npm install --include=dev && npm run build` | Installs devDeps + builds |
| Publish dir | `dist` | Output folder |
| Node version | `20` | Required for Vite |
| `/*` → `index.html` | 200 redirect | SPA client-side routing |
| `/api/privatbank-rate` | Proxy to PrivatBank API | Avoid CORS on exchange rate |
| Security headers | X-Frame-Options, X-XSS-Protection, etc. | OWASP headers |
| `/assets/*` | `max-age=31536000, immutable` | Long-term asset caching |
| `/sw.js` | `no-cache` | Service worker always fresh |

## Post-Deploy Verification
After Netlify deploy completes:
- [ ] Site URL loads without errors
- [ ] Login works with production Supabase credentials
- [ ] `/parts/*` routes accessible
- [ ] PWA: open on mobile — "Add to Home Screen" appears
- [ ] Check Netlify deploy log for any warnings

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Build fails: `Cannot find module` | Missing dep in `dependencies` (not `devDependencies`) | Move to `dependencies` in `package.json` |
| Build fails: TypeScript error | `tsc` errors not caught locally | Run `npx tsc --noEmit` and fix |
| Blank page after deploy | SPA redirect missing | Check `netlify.toml` has `/* → /index.html` rule |
| Supabase 401 errors | Env vars not set in Netlify | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify dashboard |
| CORS on PrivatBank API | Missing proxy rule | Check `netlify.toml` redirect for `/api/privatbank-rate` |
| PWA not installing | `sw.js` cached old version | Headers set `no-cache` for `sw.js` — force refresh |
