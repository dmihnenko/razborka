---
name: browser-test
description: 'Browser smoke testing for TSP-V2. Use when: checking pages load, verifying routes respond, E2E smoke test, visual inspection, testing public pages, checking dev or preview server, functional testing after deploy.'
argument-hint: 'Optional: smoke | login | routing | pwa | all (default: smoke)'
---

# Browser E2E Test — TSP-V2

Playwright-powered E2E smoke tests for the TSP-V2 React/TypeScript/Supabase project.

## Available Tools

| Tool | What it does |
|------|-------------|
| `npm run e2e` | Run all Playwright tests (headless, auto-starts preview server) |
| `npm run e2e:headed` | Run with visible browser window |
| `npm run e2e:ui` | Open Playwright UI explorer |
| `npm run e2e:debug` | Step-through debugger |
| `fetch_webpage` | Quick HTTP check without a browser |
| `open_browser_page` | Open page in VS Code integrated browser |

**Test files:** `e2e/smoke.spec.ts`  
**Config:** `playwright.config.ts` (baseURL: `http://localhost:4173`, browser: Chromium)

---

## Quick Run

```powershell
# Run all E2E tests (preview server starts automatically)
npm run e2e

# Run with browser visible
npm run e2e:headed

# Run a specific test file
npx playwright test e2e/smoke.spec.ts

# Run only tests matching a name pattern
npx playwright test --grep "login"
```

The `playwright.config.ts` has `webServer` configured — it auto-starts `npm run preview` on port 4173 before tests and stops it after.

---

## What the Smoke Tests Cover (`e2e/smoke.spec.ts`)

### Public Routes
- [ ] `/login` — page loads, form visible, title "CRM"
- [ ] `/vehicle-access` — page loads, code input visible

### SPA Routing (13 routes)
- [ ] All protected routes return HTTP 200 (no 404)
- [ ] Routes: `/`, `/customers`, `/vehicles`, `/appointments`, `/work-orders`, `/parts`, `/parts/vehicles`, `/parts/inventory`, `/parts/orders`, `/parts/customers`, `/admin`, `/analytics`

### PWA Assets
- [ ] `/manifest.webmanifest` — 200, has `name` and `short_name`
- [ ] `/sw.js` — 200

### Login Form
- [ ] Empty submit triggers validation
- [ ] Wrong credentials shows error toast

### Auth Redirect
- [ ] `/` (dashboard) redirects to `/login` when not authenticated
- [ ] `/parts` redirects to `/login` when not authenticated

---

## Adding New E2E Tests

Create test files in `e2e/`:

```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test'

test('feature works', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder(/Email или Username/i).fill('user@example.com')
  await page.getByPlaceholder(/Пароль/i).fill('password')
  await page.getByRole('button', { name: /войти/i }).click()
  await expect(page).toHaveURL('/')
})
```

---

## Cleanup

Playwright auto-manages the preview server (starts/stops via `webServer` in config).

Remove test artifacts after debugging:
```powershell
Remove-Item -Recurse -Force test-results -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force playwright-report -ErrorAction SilentlyContinue
```

These directories are in `.gitignore` — they won't be committed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Error: browserType.launch` | Run `npx playwright install chromium` |
| Tests timeout | Check if app loads; increase `timeout` in `playwright.config.ts` |
| Login toast test fails | Supabase may be unreachable in local env without valid `.env.local` |
| `Cannot find module '@playwright/test'` | Run `npm install` |
| Port 4173 already in use | `Get-Process node \| Stop-Process -Force` |

## Available Browser Tools
- **`fetch_webpage`** — fetches rendered HTML/text from a URL; checks if page loads, finds visible text
- **`open_browser_page`** — opens a URL in the VS Code integrated browser for visual inspection

> **Limitation:** No click/form-fill automation. Auth-protected pages return the login redirect.  
> For full functional testing, use the [qa-check](../qa-check/SKILL.md) unit tests.

---

## Step 1 — Start the Server

Use `npm run preview` (production build) — always preferred over dev server for smoke tests:

```powershell
# Build first if dist/ is stale
npm run build:check

# Start preview server in background (port 4173)
npm run preview
```

Or use the dev server (port 5173):
```powershell
npm run dev
```

Record the terminal ID so you can kill it in cleanup.

---

## Step 2 — Check Public Routes (no auth required)

These pages are accessible without login. Use `fetch_webpage` to verify content:

```
Public pages to check:
- http://localhost:4173/login
- http://localhost:4173/vehicle-access
- http://localhost:4173/public/personal-vehicle/<id>  (requires known ID)
- http://localhost:4173/public/customer/<id>
- http://localhost:4173/public/parts-customer/<id>
```

**Example fetch_webpage call:**
- URL: `http://localhost:4173/login`
- Query: `"login form CRM email password"`
- Expected: finds "CRM", email/password inputs or login text

**What to look for:**
- `<title>` matches "CRM" or app name
- No error page ("Cannot GET /" → server not running)
- No "white screen" (empty HTML body)
- Login page: visible form elements text

---

## Step 3 — Open Browser for Visual Inspection

Use `open_browser_page` to launch the app visually:

```
Pages to open:
http://localhost:4173/login         ← Auth: login form
http://localhost:4173/              ← Auth: dashboard (will redirect to /login if not authed)
http://localhost:4173/parts         ← Auth: parts subsystem
http://localhost:4173/vehicle-access ← Public: vehicle access code page
```

Check visually:
- [ ] Login form renders correctly
- [ ] No console errors visible in Network/Console tab
- [ ] Page title is correct
- [ ] Favicon loads

---

## Step 4 — Verify SPA Routing (404 Check)

SPA redirects must work — all URLs should return `index.html`, not 404:

```powershell
# These should all return HTTP 200 with index.html
Invoke-WebRequest -Uri "http://localhost:4173/customers" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "http://localhost:4173/parts/orders" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "http://localhost:4173/admin/users" -UseBasicParsing | Select-Object StatusCode
```

Expected: all return `StatusCode: 200`.

> Netlify config (`netlify.toml`) handles this in production via redirect rules.  
> The Vite preview server handles it locally.

---

## Step 5 — Check PWA Manifest & Service Worker

```powershell
Invoke-WebRequest -Uri "http://localhost:4173/manifest.webmanifest" -UseBasicParsing | Select-Object StatusCode, ContentType
Invoke-WebRequest -Uri "http://localhost:4173/sw.js" -UseBasicParsing | Select-Object StatusCode
```

Expected:
- `manifest.webmanifest` → 200, ContentType: `application/manifest+json`
- `sw.js` → 200

---

## Step 6 — Cleanup

Kill the background server process after testing:

```powershell
# Find and kill the preview/dev server process
Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*vite*" } | Stop-Process -Force

# Or if you know the terminal ID from run_in_terminal:
# Use kill_terminal tool with the background terminal ID
```

Remove any temporary test files created during the session:
```powershell
# Remove any temp files created by tests (e.g., screenshots, temp JSON)
Remove-Item -Path ".\temp_*" -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\*.tmp" -Force -ErrorAction SilentlyContinue
```

---

## Smoke Test Checklist

### Public Routes
- [ ] `/login` loads with form text visible
- [ ] `/vehicle-access` loads with input field text
- [ ] SPA routes return 200 (no 404)

### Assets
- [ ] `/manifest.webmanifest` returns 200
- [ ] `/sw.js` returns 200
- [ ] `/favicon.ico` or `/favicon.svg` returns 200

### Visual (open_browser_page)
- [ ] Login page looks correct (no broken layout)
- [ ] Redirect to /login works for protected routes

---

## Typical fetch_webpage Queries by Page

| Page | Query to use |
|------|-------------|
| `/login` | `"login form email password CRM"` |
| `/vehicle-access` | `"vehicle access code input"` |
| `/public/personal-vehicle/:id` | `"vehicle history maintenance cost"` |
| `/public/customer/:id` | `"customer vehicles appointments history"` |
| any page | `"error 404 not found"` (should NOT find this) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `fetch_webpage` returns empty / connection refused | Server not running — start it first |
| Returns login page instead of content | Expected — auth-protected routes redirect |
| `StatusCode: 404` on SPA routes | Vite preview not configured for SPA; use dev server |
| `sw.js` returns 404 | Run `npm run build:check` first to generate PWA assets |
| "Cannot GET /" in browser | Wrong port — check if server started on 5173 vs 4173 |
