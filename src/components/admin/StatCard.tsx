import { Link } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'

export type StatColor = 'indigo' | 'blue' | 'orange' | 'emerald' | 'purple' | 'gray' | 'red'

// Ink & Signal: нейтральные плитки + индиго-акцент (signal). Без радужной палитры.
// Все «цветные» значения сведены к одному из двух стилей — signal (индиго) либо нейтраль.
const SIGNAL = { icon: 'text-indigo-600', bg: 'bg-indigo-50',  text: 'text-indigo-600' }
const NEUTRAL = { icon: 'text-gray-600',  bg: 'bg-gray-100',   text: 'text-gray-500' }

const COLOR: Record<StatColor, { icon: string; bg: string; text: string }> = {
  indigo:  SIGNAL,
  blue:    SIGNAL,
  orange:  NEUTRAL,
  emerald: NEUTRAL,
  purple:  SIGNAL,
  gray:    NEUTRAL,
  red:     NEUTRAL,
}

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: string
  icon: LucideIcon
  color?: StatColor
  to?: string
  loading?: boolean
}

/** Плитка статистики в стиле дашборда Разборки. Кликабельна, если задан `to`. */
export function StatCard({ label, value, sub, icon: Icon, color = 'indigo', to, loading }: StatCardProps) {
  const c = COLOR[color]
  const body = (
    <>
      <div className="flex items-center justify-between">
        <div className={`icon-tile w-9 h-9 ${c.bg}`}>
          <Icon className={`w-[18px] h-[18px] ${c.icon}`} strokeWidth={1.5} />
        </div>
        {to && <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />}
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

  const cls = 'stat-card group !justify-start gap-3'

  return to
    ? <Link to={to} className={`${cls} hover:border-gray-200`}>{body}</Link>
    : <div className={cls}>{body}</div>
}

export default StatCard
