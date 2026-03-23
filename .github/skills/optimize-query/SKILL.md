---
name: optimize-query
description: 'Optimize TanStack Query usage in TSP-V2. Use when: too many refetches, stale data after mutation, slow page loads, missing enabled guard, wrong queryKey structure, unnecessary network requests, cache not working, query being called with undefined params.'
argument-hint: 'Hook or page with the query issue, e.g. "Analytics page refetches on every render"'
---

# Optimize Query — TSP-V2

Patterns for correct and efficient TanStack Query v5 usage in TSP-V2.

## When to Use
- Query fires when params are `undefined` (e.g., `companyId` before auth loads)
- Data goes stale immediately after a mutation
- Cache not shared between components on the same page
- Too many network requests visible in DevTools
- `isLoading` flickers on every navigation

## TanStack Query v5 Syntax (project uses v5)

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
```

v5 differences from v4:
- `status === 'loading'` → now `status === 'pending'`
- `isLoading` → still works for convenience
- Options object is flat: no nested `options.onSuccess` — use `useMutation({ onSuccess })`

## QueryKey Conventions

QueryKeys must include ALL variables the query depends on:
```ts
// ❌ Wrong — doesn't refetch when companyId changes
queryKey: ['customers']

// ✅ Correct
queryKey: ['customers', companyId]

// ✅ With filters
queryKey: ['appointments', companyId, { status, dateRange }]
```

Hierarchy convention in this project:
```ts
['entity-name', companyId]              // list
['entity-name', companyId, id]          // single item
['entity-name', companyId, 'sub-list']  // related list
```

## `enabled` Guard — Always Required

Never query without guarding against undefined params:
```ts
// ❌ Will fire with undefined companyId → RLS returns []
useQuery({
  queryKey: ['customers', profile?.sto_company_id],
  queryFn: () => getCustomers(profile?.sto_company_id!),
})

// ✅ Correct
useQuery({
  queryKey: ['customers', profile?.sto_company_id],
  queryFn: () => getCustomers(profile!.sto_company_id!),
  enabled: !!profile?.sto_company_id,
})
```

## staleTime — Reduce Unnecessary Refetches

Default `staleTime` is `0` — data goes stale immediately. For stable reference data:
```ts
// Categories, roles, companies — rarely change
useQuery({
  queryKey: ['parts-categories', companyId],
  queryFn: () => getPartsCategories(companyId),
  enabled: !!companyId,
  staleTime: 5 * 60 * 1000,  // 5 minutes
})

// Exchange rates — update every 10 min is fine
useQuery({
  queryKey: ['exchange-rate'],
  queryFn: fetchExchangeRate,
  staleTime: 10 * 60 * 1000,
  refetchInterval: 10 * 60 * 1000,
})
```

## Mutation Invalidation — Keep Cache Fresh

Always invalidate after mutations:
```ts
const queryClient = useQueryClient()

useMutation({
  mutationFn: createCustomer,
  onSuccess: () => {
    // Invalidate the list
    queryClient.invalidateQueries({ queryKey: ['customers', companyId] })
    toast.success('Клиент добавлен')
  },
  onError: (error) => {
    toast.error('Ошибка при создании клиента')
    console.error(error)
  },
})
```

For mutations that affect multiple entities (e.g., completing an order updates inventory):
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['parts-orders', companyId] })
  queryClient.invalidateQueries({ queryKey: ['parts-inventory', companyId] })
}
```

## Optimistic Updates (for instant UI)

```ts
useMutation({
  mutationFn: updateStatus,
  onMutate: async ({ id, status }) => {
    await queryClient.cancelQueries({ queryKey: ['appointments', companyId] })
    const previous = queryClient.getQueryData(['appointments', companyId])
    queryClient.setQueryData(['appointments', companyId], (old: Appointment[]) =>
      old.map((a) => (a.id === id ? { ...a, status } : a))
    )
    return { previous }
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['appointments', companyId], context?.previous)
    toast.error('Ошибка обновления статуса')
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['appointments', companyId] })
  },
})
```

## Common Anti-patterns & Fixes

| Anti-pattern | Fix |
|---|---|
| `enabled: !!id` missing | Always add `enabled` when param can be undefined |
| `queryKey: ['data']` — no scope | Include `companyId` in all company-scoped queries |
| No `invalidateQueries` in mutation | Add `onSuccess` with specific queryKey invalidation |
| `staleTime` not set for static data | Add `staleTime: 5 * 60 * 1000` for reference data |
| Calling `useQuery` inside a condition | Move up — hooks must not be conditional |
| Fetching in `useEffect` instead of `useQuery` | Replace with `useQuery` — handles loading/error/cache automatically |

## Debugging

Enable React Query Devtools (already configured in project):
- Shows all active queries, their state, and cache contents
- Check "Observers" count — if > expected, queries are being duplicated
- Check "Data updated at" — verify cache is being used

```tsx
// Already in main.tsx — visible in development only
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
```
