---
name: write-tests
description: 'Write tests for TSP-V2 using Vitest and @testing-library/react. Use when: adding unit tests, writing tests for a service, hook, or component, increasing test coverage, TDD red-green workflow, testing Supabase service functions, testing React hooks.'
argument-hint: 'File or module to test, e.g. "src/services/partsService.ts" or "useConfirm hook"'
---

# Write Tests — TSP-V2

Workflow for writing Vitest + @testing-library/react tests following project conventions.

## When to Use
- Adding tests for a new service, hook, or component
- TDD: write failing test before fixing a bug (see [fix-bug skill](../fix-bug/SKILL.md))
- Increasing coverage for `src/services/**` and `src/utils/**` (target: ≥ 70%)

## Test Infrastructure

### Mock Supabase
All tests use the shared mock at `src/test/mocks/supabase.ts`:
```ts
import '../test/mocks/supabase'
import { mockSupabase, setFromResponse } from '../test/mocks/supabase'
```

`setFromResponse(data, error)` — sets the value that the next Supabase query resolves with.

The mock builder supports full chains: `.select().eq().order()` → resolves to `{ data, error }`.

### File Placement
- Service test: `src/services/<name>.test.ts` (next to the service file)
- Hook test: `src/hooks/<name>.test.ts`
- Component test: `src/pages/<Name>.test.tsx` or `src/components/<Name>.test.tsx`

## Patterns

### Testing a Service Function
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../test/mocks/supabase'
import { getCustomers } from '@/services/customerService'
import { setFromResponse } from '../test/mocks/supabase'

describe('getCustomers', () => {
  beforeEach(() => {
    setFromResponse(null, null) // reset between tests
  })

  it('возвращает список клиентов', async () => {
    const mockData = [{ id: '1', name: 'Иван', phone: '+380501234567' }]
    setFromResponse(mockData, null)

    const result = await getCustomers('sto-company-1')
    expect(result).toEqual(mockData)
  })

  it('выбрасывает ошибку при сбое Supabase', async () => {
    setFromResponse(null, { message: 'DB error' })
    await expect(getCustomers('sto-1')).rejects.toThrow()
  })
})
```

### Testing a React Hook
```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMyHook } from '@/hooks/useMyHook'

describe('useMyHook', () => {
  it('начальное состояние корректно', () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current.value).toBe(false)
  })

  it('toggle меняет значение', () => {
    const { result } = renderHook(() => useMyHook())
    act(() => result.current.toggle())
    expect(result.current.value).toBe(true)
  })
})
```

### Testing a Component (RTL)
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  it('отображает заголовок', () => {
    render(<MyComponent title="Тест" />)
    expect(screen.getByText('Тест')).toBeInTheDocument()
  })

  it('вызывает onDelete при клике', () => {
    const onDelete = vi.fn()
    render(<MyComponent title="X" onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /удалить/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
```

### Factory Helper Pattern
Use factory functions for test data (see `trashService.test.ts`):
```ts
function makeCustomer(override?: Partial<Customer>): Customer {
  return {
    id: 'customer-1',
    name: 'Test Customer',
    phone: '+380501234567',
    created_at: '2024-01-01T00:00:00Z',
    sto_company_id: 'sto-1',
    ...override,
  }
}
```

## Procedure

### Step 1 — Read the Source
Read the file to be tested. Note all exported functions, their inputs, outputs, and error cases.

### Step 2 — List Test Cases
For each function, list:
- Happy path (normal input → expected output)
- Empty/null input
- Error path (Supabase returns `error`)
- Edge cases (empty array, undefined optional params)

### Step 3 — Write Tests
- One `describe` block per function/hook/component
- One `it` per case, in Russian ("возвращает...", "выбрасывает...", "отображает...")
- `beforeEach` to reset mocks

### Step 4 — Run & Verify
```powershell
npm test -- --run src/services/myService.test.ts
```
All tests must be green before committing.

### Step 5 — Coverage Check
```powershell
npm run test:coverage
```
Target ≥ **70%** for `src/services/**` and `src/utils/**`.

## Running Commands
```powershell
# Run all tests
npm test

# Run specific file
npm test -- --run src/services/trashService.test.ts

# Watch mode
npm test -- src/hooks/useConfirm.test.ts

# Coverage report
npm run test:coverage
```
