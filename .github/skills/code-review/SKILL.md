---
name: code-review
description: 'Review code in TSP-V2 for correctness, security, and conventions. Use when: reviewing a PR, checking code quality, OWASP security audit, verifying conventions are followed, checking for window.confirm, direct deletes without trash, hardcoded secrets, XSS risks, missing error handling.'
argument-hint: 'File path, component name, or area to review, e.g. "src/pages/CustomersPage.tsx"'
---

# Code Review — TSP-V2

Structured code review checklist covering correctness, security (OWASP Top 10), and project conventions.

## When to Use
- Reviewing a pull request before merge
- Auditing a file or module for issues
- Self-checking before committing
- Security audit pass

## Procedure

Read the target file(s) fully before reviewing. Use search to find patterns across the codebase if needed.

---

## Checklist

### 1. Project Conventions
- [ ] **Confirmation dialogs**: only `useConfirm()` + `<ConfirmDialog>` — no `window.confirm()`, `confirm()`, `alert()`
- [ ] **Notifications**: only `toast.success` / `toast.error` from **sonner** — no `alert()`, `console.error` shown to user
- [ ] **Deletion**: calls `moveToTrash()` from `trashService` — no direct Supabase `.delete()` without trash
- [ ] **Supabase queries**: all in `src/services/` — no direct `supabase.from(...)` calls inside components or hooks return values
- [ ] **Env secrets**: `import.meta.env.VITE_*` — no hardcoded URLs, keys, or credentials in source
- [ ] **Lazy loading**: new pages added to `App.tsx` as `lazy(() => import(...))` wrapped in `<Suspense>`

### 2. Security (OWASP Top 10)
- [ ] **Injection**: no raw SQL — all queries via Supabase SDK (parameterized)
- [ ] **XSS**: no `dangerouslySetInnerHTML` with user-controlled data; React auto-escapes JSX
- [ ] **Broken Access Control**: queries filter by `company_id` from auth context — no user-supplied IDs that bypass RLS
- [ ] **Sensitive data exposure**: no passwords, tokens, or PII logged to console or stored in `localStorage`
- [ ] **CSRF**: Supabase JWT tokens in memory/cookie — not in URL params
- [ ] **Hardcoded secrets**: grep for `supabase.co`, `eyJ`, `sk_`, API keys in source → none allowed
- [ ] **SSRF**: no `fetch(userInput)` or server-side URL construction from untrusted data

### 3. TypeScript
- [ ] No `as any` without a comment explaining why it's safe
- [ ] No `@ts-ignore` / `@ts-expect-error` without explanation
- [ ] All function parameters and return types are explicit where non-obvious
- [ ] No implicit `any` from missing type definitions

### 4. React & TanStack Query
- [ ] `useQuery` has `enabled` guard when queryKey params might be undefined: `enabled: !!companyId`
- [ ] Mutations call `queryClient.invalidateQueries` in `onSuccess` to keep cache fresh
- [ ] Loading states (`isLoading`) show a spinner — no blank screen during fetch
- [ ] Error states (`isError`) show a user-facing message — no silent failures
- [ ] No direct state mutation (`state.items.push(...)`) — always use immutable updates

### 5. Component Quality
- [ ] No business logic in JSX — extract to hooks or service functions
- [ ] Large components (> 300 lines) should be split
- [ ] `useEffect` dependencies array is correct — no missing deps, no unnecessary deps
- [ ] Event handlers don't accidentally recreate on every render (use `useCallback` if passed as props)
- [ ] Keys in `.map()` use stable unique IDs — not array indices

### 6. Error Handling
- [ ] Async functions have `try/catch` or `.catch()` — unhandled promise rejections must not reach the user silently
- [ ] Supabase responses check `if (error) throw error` — not just reading `data`
- [ ] `ErrorBoundary` wraps route-level components

### 7. Performance
- [ ] No expensive computations in render — move to `useMemo` if needed
- [ ] No unnecessary `useEffect` that could be derived state
- [ ] Images have explicit dimensions to prevent layout shift
- [ ] No prop drilling > 2 levels — use context or TanStack Query directly

### 8. Code Style
- [ ] No commented-out code blocks (dead code)
- [ ] No `console.log` / `console.error` left in production code
- [ ] Import paths use `@/` alias, not relative `../../..`
- [ ] Consistent naming: PascalCase components, camelCase functions/vars, UPPER_SNAKE constants

## Quick Grep Patterns — Anti-patterns to Search

```powershell
# window.confirm usage
Select-String -Path "src/**/*.tsx" -Pattern "window\.confirm|confirm\(" -Recurse

# Direct Supabase delete (without trash)
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "\.delete\(\)" -Recurse

# dangerouslySetInnerHTML
Select-String -Path "src/**/*.tsx" -Pattern "dangerouslySetInnerHTML" -Recurse

# console.log left in code
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "console\.(log|error|warn)" -Recurse

# Hardcoded Supabase/API keys
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "eyJ|supabase\.co|sk_" -Recurse
```

## Reporting Issues
For each finding, note:
1. **File + line** — exact location
2. **Severity** — Critical / High / Medium / Low
3. **Issue** — what's wrong
4. **Fix** — concrete change needed

Then apply fixes using the [fix-bug skill](../fix-bug/SKILL.md) workflow.
