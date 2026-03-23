---
name: db-migration
description: 'Create Supabase SQL migrations for TSP-V2. Use when: adding a new table, adding a column, writing RLS policies, creating a database function or trigger, modifying schema, creating a migration file in database/ folder.'
argument-hint: 'Describe the change, e.g. "add notes column to appointments" or "new table for invoices"'
---

# DB Migration — TSP-V2

Workflow for creating Supabase SQL migrations following project conventions.

## When to Use
- Adding a new table or column
- Writing or updating RLS policies
- Creating a PostgreSQL function or trigger
- Fixing a schema issue

## File Convention

Migration scripts live in `database/`:
```
database/
  add_<feature>.sql       # Add new columns/tables
  fix_<issue>.sql         # Fix existing schema/policies
  create_<entity>.sql     # Create a brand new table
  check_<thing>.sql       # Diagnostic queries (read-only)
  migrations/             # Versioned migrations folder
```

Name the file descriptively: `add_notes_to_appointments.sql`, `fix_parts_orders_rls.sql`.

## Standard Table Template

```sql
-- ============================================================
-- Таблица: <table_name>
-- ============================================================
create table if not exists <table_name> (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Foreign keys
  sto_company_id uuid references sto_companies(id) on delete cascade,
  
  -- Fields
  name text not null,
  description text,
  is_active boolean default true,
  
  -- Constraints
  constraint <table_name>_name_not_empty check (char_length(name) > 0)
);

-- Index for common queries
create index if not exists idx_<table_name>_company 
  on <table_name>(sto_company_id);

-- Enable RLS
alter table <table_name> enable row level security;
```

## RLS Policy Templates

```sql
-- ──────────────────────────────────────
-- SELECT: users see only their company's data
-- ──────────────────────────────────────
create policy "<table>_select_own_company"
  on <table_name> for select
  using (
    sto_company_id = (
      select sto_company_id from user_profiles
      where id = auth.uid()
    )
  );

-- ──────────────────────────────────────
-- INSERT: users can insert for their company
-- ──────────────────────────────────────
create policy "<table>_insert_own_company"
  on <table_name> for insert
  with check (
    sto_company_id = (
      select sto_company_id from user_profiles
      where id = auth.uid()
    )
  );

-- ──────────────────────────────────────
-- UPDATE / DELETE: same pattern
-- ──────────────────────────────────────
create policy "<table>_update_own_company"
  on <table_name> for update
  using (
    sto_company_id = (
      select sto_company_id from user_profiles
      where id = auth.uid()
    )
  );

create policy "<table>_delete_own_company"
  on <table_name> for delete
  using (
    sto_company_id = (
      select sto_company_id from user_profiles
      where id = auth.uid()
    )
  );
```

For **Авторазборка** tables, replace `sto_company_id` with `parts_company_id` and `sto_companies` with `parts_companies`.

## Add Column Template

```sql
-- Add column with safe default
alter table <table_name>
  add column if not exists <column_name> <type> default <default_value>;

-- Example:
alter table appointments
  add column if not exists notes text;

alter table appointments
  add column if not exists priority integer default 0 not null;
```

## Function/Trigger Template

```sql
-- Function
create or replace function <function_name>()
returns trigger
language plpgsql
security definer
as $$
begin
  -- logic here
  return new;
end;
$$;

-- Attach trigger
create trigger <trigger_name>
  before insert or update on <table_name>
  for each row execute function <function_name>();
```

## Procedure

### Step 1 — Check Existing Schema
Read `database/schema.sql` to understand existing tables and conventions before adding anything.

### Step 2 — Write the Migration File
- Use `if not exists` / `if exists` for idempotency (safe to run twice)
- Add comments in Russian explaining the purpose
- Always enable RLS on new tables
- Always add RLS policies after enabling RLS

### Step 3 — Add a Verify Query
At the bottom of the file, add a read-only check:
```sql
-- Verify
select column_name, data_type
from information_schema.columns
where table_name = '<table_name>'
order by ordinal_position;
```

### Step 4 — Run in Supabase SQL Editor
Execute the migration in **Supabase Dashboard → SQL Editor**.
Check for errors. If a policy already exists, drop it first:
```sql
drop policy if exists "<policy_name>" on <table_name>;
```

### Step 5 — Update TypeScript Types
If a new table or column was added, update the corresponding interface in `src/types/`.

## Common Pitfalls
- Forgetting `if not exists` → fails on re-run
- RLS enabled but no policies → all queries return empty (silent failure)
- Missing `security definer` on functions that access `auth.uid()`
- Foreign key without `on delete cascade` → orphaned records
- Forgetting to add index on `company_id` columns used in filters
