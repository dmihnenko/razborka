---
name: new-feature
description: 'Scaffold and implement a new feature in TSP-V2 following project conventions. Use when: adding a new page, adding a new CRUD module, implementing a new route, creating a new component, building a new section for СТО or Авторазборка subsystems.'
argument-hint: 'Describe the feature: e.g. "employee leave requests for СТО"'
---

# New Feature — TSP-V2

Workflow for scaffolding and implementing a new feature following TSP-V2 project conventions.

## When to Use
- Adding a new page or route
- Building a new CRUD module (list + create + edit + delete)
- Adding a new section to СТО (`/`) or Авторазборка (`/parts/*`) subsystems

## Architecture Overview

```
src/
  pages/           # Route-level components (lazy-loaded)
  components/      # Reusable UI components
  hooks/           # Custom React hooks (data + UI)
  services/        # Supabase data access layer
  types/           # TypeScript interfaces
  utils/           # Pure utility functions
```

Two independent subsystems:
- **СТО**: routes `/`, `/customers`, `/vehicles`, `/appointments`, `/work-orders`, etc.
- **Авторазборка**: routes `/parts/*` — vehicles, inventory, orders, customers, categories

## Procedure

### Step 1 — Understand Requirements
- Identify which subsystem (СТО vs Авторазборка)
- Determine Supabase table(s) involved
- List CRUD operations needed (list / create / edit / delete / restore)

### Step 2 — Types
Create or update `src/types/<entity>.ts`:
```ts
export interface MyEntity {
  id: string
  created_at: string
  // ... fields
}
```

### Step 3 — Service Layer
Create `src/services/<entity>Service.ts`:
- All Supabase queries go here — **no direct Supabase calls in components**
- Use `supabase.from('table').select(...)` with proper filters
- Deletions via `moveToTrash()` from `src/services/trashService.ts` — never raw DELETE

```ts
export async function getEntities(companyId: string): Promise<MyEntity[]> {
  const { data, error } = await supabase
    .from('my_entities')
    .select('*')
    .eq('company_id', companyId)
  if (error) throw error
  return data
}
```

### Step 4 — TanStack Query Hooks
Create `src/hooks/use<Entity>.ts`:
```ts
export function useEntities(companyId: string) {
  return useQuery({
    queryKey: ['entities', companyId],
    queryFn: () => getEntities(companyId),
    enabled: !!companyId,
  })
}

export function useCreateEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createEntity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] })
      toast.success('Запись создана')
    },
    onError: () => toast.error('Ошибка при создании'),
  })
}
```

### Step 5 — Page Component
Create `src/pages/<Entity>Page.tsx` (or `src/pages/parts/<Entity>Page.tsx`):
- Use `isLoading` → show spinner
- Use `isError` → show error message  
- Deletions: show `<ConfirmDialog>` via `useConfirm()`, then call `moveToTrash()`
- Notifications: `toast.success` / `toast.error` via **sonner**

### Step 6 — Register Route
Add lazy import and route in `src/App.tsx` (or relevant router file):
```tsx
const MyEntityPage = lazy(() => import('./pages/MyEntityPage'))

// Inside <Routes>:
<Route path="/my-entity" element={<MyEntityPage />} />
```

### Step 7 — Navigation
Add link to sidebar/navigation in the appropriate layout component.

### Step 8 — Tests
Create `src/services/<entity>Service.test.ts` and/or `src/hooks/use<Entity>.test.ts`:
- Test service functions with mocked Supabase
- Test mutation success/error flows

### Step 9 — QA
Run the [qa-check skill](../qa-check/SKILL.md) to verify everything passes.

## Mandatory Conventions

| Rule | Correct | Wrong |
|------|---------|-------|
| Confirmation | `useConfirm()` + `<ConfirmDialog>` | `window.confirm()` |
| Notifications | `toast.success/error` (sonner) | `alert()` |
| Deletion | `moveToTrash()` | direct Supabase DELETE |
| Secrets | `import.meta.env.VITE_*` | hardcoded strings |
| `dangerouslySetInnerHTML` | never with user input | — |

## Trash Integration
Every entity that supports deletion must:
1. Add entry to `ENTITY_LABELS` in `src/services/trashService.ts`
2. Call `moveToTrash(entityType, id, label, stoCompanyId?, partsCompanyId?)` on delete
3. Appear in the appropriate trash page (`/sto/trash` or `/parts/trash`)
