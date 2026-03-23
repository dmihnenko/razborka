---
name: supabase-rls
description: 'Debug Supabase Row Level Security issues in TSP-V2. Use when: query returns empty array but data exists, getting 403 or permission denied, RLS blocking insert or update, user sees other company data, policies not working, infinite loading after login.'
argument-hint: 'Table name or symptom, e.g. "customers table returns empty" or "parts_inventory 403"'
---

# Supabase RLS Debug — TSP-V2

Systematic approach to diagnosing and fixing Row Level Security (RLS) issues.

## Symptoms of RLS Problems
- Query returns `[]` or `null` but data definitely exists in the table
- Supabase response: `{ data: [], error: null }` — silently blocked by RLS
- Network tab shows `403` or `{ code: "42501", message: "permission denied" }`
- User sees data from another company (policy too permissive)
- Infinite loading spinner after login

## Step 1 — Check RLS is Enabled

Run in **Supabase → SQL Editor**:
```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```
`rowsecurity = true` means RLS is active on that table.

## Step 2 — List Existing Policies

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = '<your_table>'
order by cmd;
```

Check:
- Is there a policy for the needed operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)?
- Does `qual` reference `auth.uid()` correctly?
- Is `roles` set to `{authenticated}` or `{public}`?

## Step 3 — Check What the User Profile Returns

```sql
-- Run as the specific user (or use service role to check)
select id, sto_company_id, parts_company_id, role_id
from user_profiles
where id = auth.uid();
```

If `sto_company_id` is `null` → the user is not assigned to a company → all company-scoped queries return empty.

## Step 4 — Test the Policy Logic

Simulate the policy condition manually:
```sql
-- Replace 'user-uuid-here' with actual user ID
select *
from <table_name>
where sto_company_id = (
  select sto_company_id from user_profiles where id = 'user-uuid-here'
);
```

If this returns data with the service role but not as the authenticated user → policy is wrong.

## Step 5 — Common Fixes

### Fix: Policy missing for operation
```sql
-- Add missing SELECT policy
create policy "<table>_select_own_company"
  on <table_name> for select
  using (
    sto_company_id = (
      select sto_company_id from user_profiles where id = auth.uid()
    )
  );
```

### Fix: User not assigned to company
```sql
update user_profiles
set sto_company_id = '<company-uuid>'
where id = '<user-uuid>';
```

### Fix: Policy references wrong column
Check whether the table uses `sto_company_id` (СТО subsystem) or `parts_company_id` (Авторазборка):
```sql
select column_name from information_schema.columns
where table_name = '<table_name>'
  and column_name like '%company_id%';
```

### Fix: Conflicting policies (too permissive)
Drop and recreate:
```sql
drop policy if exists "<old_policy_name>" on <table_name>;
-- then create the correct one
```

### Fix: Public table (no RLS needed)
If a table should be readable by all authenticated users:
```sql
create policy "<table>_select_authenticated"
  on <table_name> for select
  using (auth.role() = 'authenticated');
```

## TSP-V2 Company ID Convention

| Subsystem | Profile column | Table column |
|-----------|---------------|--------------|
| СТО | `user_profiles.sto_company_id` | `sto_company_id` |
| Авторазборка | `user_profiles.parts_company_id` | `parts_company_id` |
| Admin | any — bypassed in policy | — |

Admin users bypass RLS via:
```sql
using (
  auth.uid() in (select id from user_profiles where role_id = (
    select id from roles where name = 'admin'
  ))
  or sto_company_id = (select sto_company_id from user_profiles where id = auth.uid())
)
```

## Diagnostic Scripts in `database/`

The project already has these diagnostic files — run them when debugging:
- `database/check_rls_policies.sql` — list all policies
- `database/check_user_roles.sql` — check user role assignment
- `database/check_auth.sql` — verify auth.uid() works
- `database/verify_rls_status.sql` — RLS enabled/disabled per table
- `database/diagnose_roles.sql` — full role diagnosis

## Frontend Side: Confirming the Issue

Add temporary debug logging in the service function:
```ts
const { data, error } = await supabase.from('customers').select('*')
console.log('RLS debug:', { data, error, count: data?.length })
```

If `error` is null but `data` is `[]`, it's an RLS issue (not a code bug).
Remove debug logging before committing.
