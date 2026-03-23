---
name: analytics-charts
description: 'Add or modify charts in TSP-V2 analytics pages using Recharts. Use when: adding a new chart, modifying existing graphs, working on /analytics, /parts/analytics, /statistics, /monthly-revenue pages, formatting chart data, adding tooltips, changing chart colors.'
argument-hint: 'Chart type and data source, e.g. "bar chart of monthly revenue by category"'
---

# Analytics Charts — TSP-V2

Workflow for building and modifying charts using Recharts on TSP-V2 analytics pages.

## When to Use
- Adding a new chart to `/analytics`, `/parts/analytics`, `/statistics`, `/monthly-revenue`
- Modifying colors, tooltips, or formatters on existing charts
- Adding a new time-period selector
- Formatting currency/number values on axes

## Recharts Imports (used in project)

```ts
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
```

## Data Formatting Utilities

Used across analytics pages — replicate this pattern:
```ts
const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                     'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

// Format large numbers for axis/tooltip
function fmt(n: number) {
  if (n >= 1_000_000) return `₴${(n / 1_000_000).toFixed(1)}М`
  if (n >= 1_000) return `₴${(n / 1_000).toFixed(1)}к`
  return `₴${n}`
}

// For USD amounts
function fmtUSD(n: number) {
  return `$${n.toLocaleString('uk-UA', { minimumFractionDigits: 0 })}`
}
```

## Chart Components

### Bar Chart (monthly revenue)
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
    <Tooltip formatter={(value: number) => [fmt(value), 'Дохід']} />
    <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Multi-series Bar Chart
```tsx
<BarChart data={chartData}>
  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
  <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
  <Tooltip formatter={(value: number, name: string) => [fmt(value), name]} />
  <Legend />
  <Bar dataKey="parts" name="Запчастини" fill="#3B82F6" radius={[4, 4, 0, 0]} />
  <Bar dataKey="work" name="Роботи" fill="#10B981" radius={[4, 4, 0, 0]} />
</BarChart>
```

### Line Chart (trend over time)
```tsx
<ResponsiveContainer width="100%" height={250}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
    <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
    <Tooltip formatter={(value: number) => [fmt(value), 'Сума']} />
    <Legend />
    <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
    <Line type="monotone" dataKey="paid" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
  </LineChart>
</ResponsiveContainer>
```

### Pie Chart (distribution)
```tsx
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie
      data={pieData}
      dataKey="value"
      nameKey="name"
      cx="50%"
      cy="50%"
      outerRadius={90}
      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
    >
      {pieData.map((_entry, index) => (
        <Cell key={index} fill={COLORS[index % COLORS.length]} />
      ))}
    </Pie>
    <Tooltip formatter={(value: number) => fmt(value)} />
  </PieChart>
</ResponsiveContainer>
```

## Period Selector Pattern

```tsx
const PERIOD_OPTIONS = [
  { label: '3 мес', months: 3 },
  { label: '6 мес', months: 6 },
  { label: '12 мес', months: 12 },
]

const [period, setPeriod] = useState(6)

// In JSX
<div className="flex gap-2">
  {PERIOD_OPTIONS.map((opt) => (
    <button
      key={opt.months}
      onClick={() => setPeriod(opt.months)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        period === opt.months
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {opt.label}
    </button>
  ))}
</div>
```

## Data Aggregation Pattern

Grouping raw Supabase rows by month:
```ts
const monthlyData: Record<string, { count: number; total: number }> = {}

rawData.forEach((row) => {
  const date = new Date(row.created_at)
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  if (!monthlyData[key]) monthlyData[key] = { count: 0, total: 0 }
  monthlyData[key].count += 1
  monthlyData[key].total += row.amount ?? 0
})

// Convert to sorted array for chart
const chartData = Object.entries(monthlyData)
  .sort(([a], [b]) => a.localeCompare(b))
  .slice(-period)  // last N months
  .map(([key, values]) => {
    const [year, month] = key.split('-')
    return {
      month: `${MONTH_NAMES[parseInt(month) - 1]} ${year}`,
      ...values,
    }
  })
```

## Procedure

### Step 1 — Identify Data Source
Which Supabase table(s) feed this chart? Check existing analytics pages for reference queries.

### Step 2 — Write / Extend useQuery
Add the query in the page component or a custom hook. Include `enabled` guard and appropriate `staleTime`.

### Step 3 — Transform Data
Group/aggregate raw rows into the `chartData` array format Recharts expects.

### Step 4 — Choose Chart Type
- Totals over time → `BarChart` or `LineChart`
- Comparison of categories → `BarChart` (grouped)
- Distribution / share → `PieChart`
- Trend + cumulative → `LineChart` with multiple `<Line>`

### Step 5 — Wrap in ResponsiveContainer
Always use `<ResponsiveContainer width="100%" height={N}>` — never hardcode pixel width.

### Step 6 — Test at 375px
Charts must not overflow on mobile. Use `height={220}` for mobile-aware containers or add `className="sm:h-72"`.
