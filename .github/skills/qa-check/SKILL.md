---
name: qa-check
description: 'Full QA pipeline for TSP-V2. Use when: running quality checks, verifying build, checking TypeScript errors, running tests, checking lint, before committing, before deploying, QA review, automated check, validate changes.'
argument-hint: 'Optional focus area: lint | types | tests | build | all (default: all)'
---

# QA Check — TSP-V2

Full quality assurance pipeline for the TSP-V2 React/TypeScript/Supabase project.

## When to Use
- Before committing or opening a PR
- After implementing a new feature or fix
- When user asks to "verify everything works" or "check for errors"
- When investigating lint/TypeScript/test failures

## Procedure

### Step 1 — TypeScript
```powershell
npx tsc --noEmit
```
Expected: **0 errors**. Fix every error before proceeding.

### Step 2 — ESLint
```powershell
npm run lint
```
Expected: **0 warnings, 0 errors**. Do not use `// eslint-disable` as a workaround — fix the root cause.

### Step 3 — Unit Tests
```powershell
npm test
```
Expected: all tests **green**. If tests fail, investigate per [fix-bug](..fix-bug/SKILL.md) workflow.

### Step 4 — Test Coverage
```powershell
npm run test:coverage
```
Expected: coverage ≥ **70%** for `src/utils/**` and `src/services/**`.

### Step 5 — Production Build
```powershell
npm run build:check
```
Expected: build completes without errors.

## Interpreting Results

| Tool | Failure Symptom | Typical Fix |
|------|-----------------|-------------|
| `tsc` | `error TS…` | Fix types; never use `as any` without justification |
| `lint` | `error` / `warning` | Follow eslint suggestion or fix root cause |
| `npm test` | red ✗ | See [fix-bug skill](../fix-bug/SKILL.md) |
| `build:check` | compilation error | Usually a TS or import issue |

## Key Project Conventions (checked during QA)
- Confirmation dialogs: **only** `useConfirm` + `<ConfirmDialog>` — never `window.confirm()`
- Notifications: **sonner** (`toast.success` / `toast.error`) — never `alert()`
- Deletions: **always** via `moveToTrash()` — never direct `DELETE` without trash
- No `dangerouslySetInnerHTML` with user input
- No hardcoded secrets — use `VITE_*` env variables

## Quick Reference — Full Sequence
```powershell
npx tsc --noEmit ; npm run lint ; npm test ; npm run build:check
```
