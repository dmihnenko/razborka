import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export type StatColor = 'indigo' | 'blue' | 'orange' | 'emerald' | 'purple' | 'gray' | 'red'

const COLOR: Record<StatColor, { icon: string; bg: string; text: string }> = {
  indigo:  { icon: 'text-indigo-600',  bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  blue:    { icon: 'text-blue-600',    bg: 'bg-blue-50',    text: 'text-blue-600' },
  orange:  { icon: 'text-orange-600',  bg: 'bg-orange-50',  text: 'text-orange-600' },
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  purple:  { icon: 'text-purple-600',  bg: 'bg-purple-50',  text: 'text-purple-600' },
  gray:    { icon: 'text-gray-600',    bg: 'bg-gray-100',   text: 'text-gray-600' },
  red:     { icon: 'text-red-600',     bg: 'bg-red-50',     text: 'text-red-600' },
}

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: string
  icon: any
  color?: StatColor
  to?: string
  loading?: boolean
}

/** Плитка статистики в стиле дашбордов СТО/Разборки. Кликабельна, если задан `to`. */
export function StatCard({ label, value, sub, icon: Icon, color = 'indigo', to, loading }: StatCardProps) {
  const c = COLOR[color]
  const body = (
    <>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${c.icon}`} strokeWidth={1.5} />
        </div>
        {to && <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />}
      </div>
      <div>
        {loading
          ? <div className="h-7 w-12 bg-gray-100 rounded-lg animate-pulse mb-1" />
          : <p className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none">{value}</p>}
        <p className="text-xs text-gray-500 mt-1.5">{label}</p>
        {sub && <p className={`text-[11px] font-medium mt-1 ${c.text}`}>{sub}</p>}
      </div>
    </>
  )

  const cls = 'group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col gap-3 transition-all'

  return to
    ? <Link to={to} className={`${cls} hover:shadow-md hover:border-gray-200`}>{body}</Link>
    : <div className={cls}>{body}</div>
}

export default StatCard
