---
name: mobile-adapt
description: 'Adapt TSP-V2 pages for mobile screens (375px, 768px). Use when: page looks broken on mobile, table needs cards layout, buttons too small on touch, modal overflows screen, fixing mobile UI, responsive design, PWA mobile experience.'
argument-hint: 'Page or component to adapt, e.g. "CustomersPage" or "appointments list"'
---

# Mobile Adapt — TSP-V2

Workflow for making TSP-V2 pages fully responsive using the project's built-in mobile components.

## When to Use
- Page breaks or overflows on 375px / 768px viewports
- Data table needs to switch to card layout on mobile
- Buttons/modals not touch-friendly
- Adding a new page that must be mobile-first

## Breakpoints
| Name | Width | Tailwind prefix |
|------|-------|-----------------|
| Mobile | < 640px | (no prefix) |
| Tablet | ≥ 640px | `sm:` |
| Desktop | ≥ 1024px | `lg:` |

Test at **375px** (iPhone SE) and **768px** (tablet).

## Available Mobile Components

All imports from `@/components/MobileAdaptive` and `@/components/MobileTable`.

### MobileTable — adaptive table → card list
```tsx
import { MobileTable, MobileTableColumn } from '@/components/MobileTable'

const columns: MobileTableColumn<Customer>[] = [
  { key: 'name',  header: 'Имя',   render: (c) => c.name },
  { key: 'phone', header: 'Тел',   render: (c) => c.phone },
  { key: 'email', header: 'Email',  hideOnMobile: true, render: (c) => c.email },
]

<MobileTable
  data={customers}
  columns={columns}
  keyExtractor={(c) => c.id}
  onRowClick={(c) => navigate(`/customers/${c.id}`)}
  emptyMessage="Нет клиентов"
/>
```
Add `mobileCardRender` prop for a fully custom card layout.

### MobileContainer — page wrapper with responsive padding
```tsx
import { MobileContainer } from '@/components/MobileAdaptive'
<MobileContainer>…</MobileContainer>
```

### MobilePageTitle — responsive page header + action button
```tsx
import { MobilePageTitle, MobileButton } from '@/components/MobileAdaptive'
import { Plus } from 'lucide-react'

<MobilePageTitle
  title="Клиенты"
  subtitle="Управление базой клиентов"
  action={<MobileButton icon={Plus} onClick={handleAdd}>Добавить</MobileButton>}
/>
```

### MobileButton — touch-friendly button
```tsx
<MobileButton
  icon={Plus}
  variant="primary"   // primary | secondary | danger | success
  size="md"           // sm | md | lg
  fullWidth={false}
  onClick={handleClick}
>
  Добавить клиента
</MobileButton>
```

### MobileStatCard — stat card for dashboard grids
```tsx
import { MobileStatCard } from '@/components/MobileAdaptive'
import { Users } from 'lucide-react'

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <MobileStatCard title="Клиенты" value={150} icon={Users} subtitle="+12 за месяц" color="blue" />
</div>
```

### MobileModal — adaptive modal (bottom sheet on mobile)
```tsx
import { MobileModal } from '@/components/MobileAdaptive'

<MobileModal isOpen={open} onClose={() => setOpen(false)} title="Новый клиент">
  <form>…</form>
</MobileModal>
```

## Procedure

### Step 1 — Test Current State
Open the page in DevTools at **375px**. Note what breaks:
- [ ] Horizontal scroll / overflow
- [ ] Text too small to read
- [ ] Buttons too small to tap (min 44×44px)
- [ ] Table overflows viewport
- [ ] Modal overflows screen

### Step 2 — Replace Table
If the page uses a plain `<table>` or `<div>`-based list, replace with `<MobileTable>`.
Mark columns that can be `hideOnMobile: true` (email, internal IDs, secondary info).

### Step 3 — Wrap in MobileContainer
Replace `<div className="p-4 md:p-6 ...">` page wrappers with `<MobileContainer>`.

### Step 4 — Replace Page Header
Replace custom title+button div with `<MobilePageTitle title=… action={<MobileButton>}>`.

### Step 5 — Fix Modals
Replace `<div className="fixed inset-0 ...">` custom modals with `<MobileModal>`.

### Step 6 — Replace Stat Cards
Replace custom dashboard cards with `<MobileStatCard>` inside a responsive grid.

### Step 7 — Verify
- [ ] 375px — no horizontal scroll, all text readable, all tap targets ≥ 44px
- [ ] 768px — layout looks correct
- [ ] 1280px — desktop layout unchanged
- [ ] Run `npm run build:check` — no TypeScript errors

## Common Tailwind Patterns
```tsx
// Hide on mobile, show on desktop
<span className="hidden lg:inline">Длинный текст</span>
// Show abbreviated on mobile
<span className="lg:hidden">Кратко</span>

// Stack on mobile, row on desktop
<div className="flex flex-col sm:flex-row gap-2">

// Full width on mobile, auto on desktop
<button className="w-full sm:w-auto">
```
