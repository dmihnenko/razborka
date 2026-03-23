---
name: fix-bug
description: 'Bug fixing workflow for TSP-V2. Use when: fixing a bug, debugging an error, test is failing, TypeScript error, runtime exception, wrong behavior, broken functionality, component crash, Supabase query error, UI glitch.'
argument-hint: 'Describe the bug: e.g. "customer list not loading" or paste the error message'
---

# Fix Bug — TSP-V2

Structured bug-fixing workflow for the TSP-V2 React/TypeScript/Supabase project.

## When to Use
- A test is failing (red)
- TypeScript compilation error
- Runtime exception in browser/console
- Wrong / unexpected behavior
- Supabase RLS policy blocking a query
- Component crashes or shows blank screen

## Procedure

### Step 1 — Reproduce & Locate
1. Read the error message carefully — note file path and line number
2. Search for the relevant code:
   - Component error → `src/pages/` or `src/components/`
   - Data/query error → `src/services/` or `src/hooks/`
   - Type error → `src/types/`
3. Read the file around the error — understand the context before changing anything

### Step 2 — Write a Failing Test (Red)
Before fixing, add a test that reproduces the bug:
```ts
// src/services/myService.test.ts
it('should return empty array when company has no entities', async () => {
  // arrange: mock supabase to return []
  // act: call the service function
  // assert: result is []
})
```
Run `npm test` — this test must **fail** (red).

### Step 3 — Fix the Root Cause
- Fix the actual bug — do not suppress errors with `try/catch` that hide them
- Do not use `as any` to silence TypeScript errors
- Do not use `// eslint-disable` without a comment explaining why
- If it's an RLS issue: check `database/` SQL files or Supabase dashboard policies

### Step 4 — Verify the Test Passes (Green)
Run `npm test` — the previously failing test must now **pass** (green).

### Step 5 — Full QA
Run [qa-check](../qa-check/SKILL.md) to confirm nothing else broke:
```powershell
npx tsc --noEmit ; npm run lint ; npm test
```

## Common Bug Patterns

### Supabase RLS Blocking Query
**Symptom**: data returns `null` or empty even though records exist; RLS error in network tab.
**Fix**: Check that the user's `company_id` matches the policy. Run `check_rls_policies.sql` script.

### TanStack Query Stale Data
**Symptom**: UI shows old data after mutation.
**Fix**: Call `queryClient.invalidateQueries({ queryKey: ['...'] })` in `onSuccess`.

### Missing `useConfirm` / Direct `window.confirm`
**Symptom**: Confirmation dialog uses browser native popup; fails in tests.
**Fix**: Replace with `useConfirm()` + `<ConfirmDialog {...dialogProps} />`.

### Toast Not Showing
**Symptom**: Notification never appears.
**Fix**: Ensure `<Toaster />` from **sonner** is mounted in the root layout. Use `toast.success()` / `toast.error()` — not `alert()`.

### Direct Delete Instead of Trash
**Symptom**: Record disappears without appearing in `/sto/trash` or `/parts/trash`.
**Fix**: Replace direct Supabase DELETE with `moveToTrash(entityType, id, label, companyId)`.

### Lazy-loaded Page Crashes
**Symptom**: `ChunkLoadError` or blank page after navigation.
**Fix**: Wrap the `<Route>` with `<Suspense fallback={<Spinner />}>` in `App.tsx`.

### TypeScript `Property does not exist`
**Symptom**: `error TS2339: Property 'x' does not exist on type 'Y'`
**Fix**: Update the interface in `src/types/` or add the missing field to the Supabase select query.

## Debugging Tips
- Check **browser console** for runtime errors
- Check **Network tab** → Supabase requests for 4xx errors
- Use `console.log` temporarily — remove before committing
- For Supabase errors, check `error.message` and `error.code`
- For React Query, enable devtools: `ReactQueryDevtools` is already configured
