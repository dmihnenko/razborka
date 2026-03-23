---
name: new-component
description: 'Create a reusable UI component in TSP-V2. Use when: building a shared UI element, adding to src/components/, creating a form, dialog, card, badge, or layout component using Tailwind CSS and lucide-react icons.'
argument-hint: 'Component description, e.g. "status badge for appointment" or "price input with currency selector"'
---

# New Component — TSP-V2

Workflow for creating reusable UI components using Tailwind CSS, lucide-react, and project conventions.

## Component Locations

| Type | Location |
|------|----------|
| General reusable | `src/components/` |
| UI primitives (Button, Badge, Modal…) | `src/components/ui/` |
| Mobile-adaptive | `src/components/MobileAdaptive.tsx` |
| Adaptive table | `src/components/MobileTable.tsx` |
| СТО-specific | `src/components/appointments/`, `src/components/work-orders/` |
| Авторазборка-specific | `src/components/parts/` |
| Personal vehicles | `src/components/personal-vehicles/` |

## Component Template

```tsx
import { type FC } from 'react'
// import icons from lucide-react
// import cn utility if needed

interface MyComponentProps {
  // required props first
  title: string
  // optional props with ?
  subtitle?: string
  className?: string
  onClick?: () => void
}

const MyComponent: FC<MyComponentProps> = ({ title, subtitle, className, onClick }) => {
  return (
    <div className={`rounded-xl bg-white shadow-sm border border-gray-100 p-4 ${className ?? ''}`}>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

export default MyComponent
```

## Tailwind Conventions

### Colors
```tsx
// Backgrounds
bg-white              // card background
bg-gray-50            // page/section background
bg-blue-600           // primary action
bg-red-100 text-red-700  // danger/error state

// Borders
border border-gray-200   // card border
border border-gray-100   // subtle border

// Text
text-gray-900   // primary text
text-gray-600   // secondary text
text-gray-400   // placeholder/disabled
```

### Status Colors (used throughout project)
```tsx
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-700',
}
```

### Card Pattern
```tsx
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
  {/* content */}
</div>
```

### Badge Pattern
```tsx
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
  <Circle className="w-2 h-2 fill-current" />
  Активен
</span>
```

### Button Patterns
```tsx
// Primary
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
  Сохранить
</button>

// Danger
<button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
  Удалить
</button>

// Ghost
<button className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors">
  Отмена
</button>
```

### Icons
Always import from `lucide-react`. Standard sizes:
```tsx
<Icon className="w-4 h-4" />  // inline / badge
<Icon className="w-5 h-5" />  // button icon
<Icon className="w-6 h-6" />  // section header
```

## Responsive Patterns
```tsx
// Hide on mobile
<span className="hidden sm:inline">Полный текст</span>

// Full-width on mobile, auto on desktop
<button className="w-full sm:w-auto">

// Grid that stacks on mobile
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

## Procedure

### Step 1 — Check if Component Already Exists
Before creating, search `src/components/` for something similar. Prefer extending existing components.

### Step 2 — Choose Location
- Reused across multiple pages → `src/components/`
- Pure UI primitive → `src/components/ui/`
- Feature-specific → collocate with the feature folder

### Step 3 — Create the Component File
Follow the template above. Use TypeScript interfaces for props — no `any`.

### Step 4 — Use Existing Mobile Components
If the component contains a list/table → consider `MobileTable` from `@/components/MobileTable`.
If it's a dialog → consider `MobileModal` from `@/components/MobileAdaptive`.

### Step 5 — Export & Import
- Default export for page-level / major components
- Named export for small UI primitives

### Step 6 — Verify
```powershell
npx tsc --noEmit
```
No TypeScript errors.
