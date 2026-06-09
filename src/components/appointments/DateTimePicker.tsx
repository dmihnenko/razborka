import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  value: string
  onChange: (value: string) => void
  endValue?: string | null
  onEndChange?: (value: string | null) => void
  stoCompanyId?: string | null
  excludeAppointmentId?: string
  /** Выбранный мастер (assigned_to). Если передан onWorkerChange — показывается блок выбора мастера */
  workerId?: string | null
  onWorkerChange?: (id: string | null) => void
  /** Показывать ли регулятор длительности (по умолчанию true). На финальном шаге часы берутся из нормо-часов. */
  showDuration?: boolean
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function parseLocalISO(str?: string | null): Date | null {
  if (!str) return null
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2]-1, +m[3], +(m[4]??0), +(m[5]??0), 0, 0)
}
function fmtDateLong(d: Date): string {
  const DAYS   = ['вс','пн','вт','ср','чт','пт','сб']
  const MONTHS = ['января','февраля','марта','апреля','мая','июня',
                  'июля','августа','сентября','октября','ноября','декабря']
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function addMinutes(base: Date, min: number): Date {
  return new Date(base.getTime() + min * 60_000)
}
function calcEndTime(startStr: string, selDate: Date, durMin: number): string {
  const [h, m] = startStr.split(':').map(Number)
  const start = new Date(selDate); start.setHours(h, m, 0, 0)
  return `${String(addMinutes(start, durMin).getHours()).padStart(2,'0')}:${String(addMinutes(start, durMin).getMinutes()).padStart(2,'0')}`
}
// Длительность в часах: число ("2" или "2,5")
function hoursNum(durMin: number): string {
  const h = durMin / 60
  return Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',')
}
function hoursLabel(durMin: number): string {
  return `${hoursNum(durMin)} ч`
}
const DUR_STEP = 30   // шаг 30 мин
const DUR_MIN  = 30
const DUR_MAX  = 720  // до 12 ч

function initials(name?: string | null): string {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?'
}
const AVATAR_BG = ['#2563EB','#7C3AED','#16A34A','#D97706','#DC2626','#0891B2','#DB2777','#4F46E5']
function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_BG[h % AVATAR_BG.length]
}

// ─── data ─────────────────────────────────────────────────────────────────────

// Время начала: каждые 30 мин с 08:00 до 19:30
const START_TIMES = Array.from({ length: 24 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30
  const h = Math.floor(totalMin / 60), m = totalMin % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
})

const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                   'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function getFirstDay(y: number, m: number) {
  const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DateTimePicker({
  value, onChange, endValue, onEndChange, stoCompanyId, excludeAppointmentId,
  workerId, onWorkerChange, showDuration = true,
}: Props) {
  const now = new Date()
  const selectedStart = parseLocalISO(value)

  // Фаза: дата или время
  const [phase, setPhase] = useState<'date' | 'time'>(selectedStart ? 'time' : 'date')

  // Навигация по календарю
  const [viewYear,  setViewYear]  = useState(selectedStart?.getFullYear()  ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedStart?.getMonth()     ?? now.getMonth())

  // Выбранная дата (без времени)
  const [selDate, setSelDate] = useState<Date | null>(
    selectedStart ? new Date(selectedStart.getFullYear(), selectedStart.getMonth(), selectedStart.getDate()) : null
  )

  // Выбранное время начала (строка "HH:MM")
  const [startTime, setStartTime] = useState<string>(() => {
    if (selectedStart) {
      const h = String(selectedStart.getHours()).padStart(2,'0')
      const m = String(selectedStart.getMinutes()).padStart(2,'0')
      const t = `${h}:${m}`
      return START_TIMES.includes(t) ? t : '09:00'
    }
    return '09:00'
  })

  // Выбранная длительность (в минутах)
  const [durMin, setDurMin] = useState<number>(() => {
    const end = parseLocalISO(endValue)
    if (end && selectedStart) {
      const diff = Math.round((end.getTime() - selectedStart.getTime()) / 60_000)
      return diff > 0 ? diff : 60
    }
    return 60
  })

  // Вычисляем конечное время
  const endTime = selDate ? calcEndTime(startTime, selDate, durMin) : null

  // Загружаем занятость месяца
  const { data: monthAppts = [] } = useQuery({
    queryKey: ['appts-month', stoCompanyId, viewYear, viewMonth],
    queryFn: async () => {
      if (!stoCompanyId) return []
      const from = new Date(viewYear, viewMonth, 1).toISOString()
      const to   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString()
      const { data } = await supabase
        .from('appointments')
        .select('scheduled_date, id')
        .eq('sto_company_id', stoCompanyId)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .not('status', 'in', '(archived,deleted)')
      return data || []
    },
    enabled: !!stoCompanyId,
    staleTime: 2 * 60_000,
  })

  const dayLoad = useMemo(() => {
    const map: Record<number, number> = {}
    monthAppts.forEach((a: any) => {
      if (excludeAppointmentId && a.id === excludeAppointmentId) return
      map[new Date(a.scheduled_date).getDate()] = (map[new Date(a.scheduled_date).getDate()] || 0) + 1
    })
    return map
  }, [monthAppts, excludeAppointmentId])

  // Мастера СТО (только роль sto_worker — без владельца)
  const { data: workers = [] } = useQuery({
    queryKey: ['datetime-workers', stoCompanyId],
    queryFn: async () => {
      if (!stoCompanyId) return []

      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()
      if (!role) return []

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', role.id)
      if (!userRoles || userRoles.length === 0) return []

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userRoles.map(ur => ur.user_id))
        .eq('sto_company_id', stoCompanyId)
        .eq('is_active', true)
        .order('full_name')
      if (error) return []
      return data ?? []
    },
    enabled: !!stoCompanyId && !!onWorkerChange,
    staleTime: 5 * 60_000,
  })

  // График работы СТО — сетка выбора времени
  const { data: workHours } = useQuery({
    queryKey: ['sto-work-hours', stoCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from('sto_companies').select('work_open, work_close').eq('id', stoCompanyId!).single()
      return data
    },
    enabled: !!stoCompanyId,
    staleTime: 5 * 60_000,
  })
  const timeSlots = useMemo(() => {
    const start = Math.max(0, Math.min(23, Number(workHours?.work_open ?? 9)))
    const end = Math.max(start + 1, Math.min(24, Number(workHours?.work_close ?? 19)))
    const slots: string[] = []
    for (let h = start; h < end; h++) slots.push(`${String(h).padStart(2, '0')}:00`)
    return slots
  }, [workHours])

  // Время выбрано — тогда показываем мастера
  const [timePicked, setTimePicked] = useState<boolean>(!!selectedStart)

  // Применяем изменения в родителя при смене времени/длительности
  useEffect(() => {
    if (!selDate) return
    const [h, m] = startTime.split(':').map(Number)
    const start = new Date(selDate); start.setHours(h, m, 0, 0)
    onChange(toLocalISO(start))
    if (onEndChange) {
      const end = new Date(start.getTime() + durMin * 60_000)
      onEndChange(toLocalISO(end))
    }
  }, [startTime, durMin, selDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calendar handlers ────────────────────────────────────────────────────

  const prevMonth = () => viewMonth === 0
    ? (setViewYear(y => y-1), setViewMonth(11))
    : setViewMonth(m => m-1)
  const nextMonth = () => viewMonth === 11
    ? (setViewYear(y => y+1), setViewMonth(0))
    : setViewMonth(m => m+1)

  const handleDayClick = (day: number) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const dayDate = new Date(viewYear, viewMonth, day)
    if (dayDate < today) return
    setSelDate(dayDate)
    setTimeout(() => setPhase('time'), 60)
  }

  const today = new Date(); today.setHours(0,0,0,0)
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDay(viewYear, viewMonth)

  function loadColor(n: number) {
    if (n <= 2) return 'bg-emerald-400'
    if (n <= 5) return 'bg-amber-400'
    return 'bg-red-400'
  }

  // ── Phase: DATE ────────────────────────────────────────────────────────────
  if (phase === 'date') {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Навигация */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-bold text-gray-900">{MONTHS_RU[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 px-3 py-2 border-b border-gray-50">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Дни */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i+1).map(day => {
              const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0)
              const isPast  = d < today
              const isToday = d.getTime() === today.getTime()
              const isSel   = selDate && selDate.getDate() === day && selDate.getMonth() === viewMonth && selDate.getFullYear() === viewYear
              const load    = dayLoad[day] || 0
              return (
                <button key={day} type="button"
                  onClick={() => !isPast && handleDayClick(day)}
                  disabled={isPast}
                  className={`relative flex flex-col items-center justify-center h-10 rounded-lg text-sm font-semibold transition-all
                    ${isSel   ? 'bg-primary text-white shadow-sm' :
                      isToday ? 'bg-primary/10 text-primary ring-1 ring-primary/30' :
                      isPast  ? 'text-gray-300 cursor-not-allowed' :
                                'text-gray-700 hover:bg-gray-100'}`}
                >
                  {day}
                  {!isPast && load > 0 && (
                    <span className={`absolute bottom-1 w-1 h-1 rounded-sm ${isSel ? 'bg-white/60' : loadColor(load)}`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Легенда */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50/60">
            <span className="text-[11px] text-gray-400 font-medium">Загруженность:</span>
            {[['bg-emerald-400','1–2'],['bg-amber-400','3–5'],['bg-red-400','6+']] .map(([c,l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${c}`} />
                <span className="text-[11px] text-gray-500">{l}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Переход к времени если дата уже выбрана */}
        {selDate && (
          <button type="button" onClick={() => setPhase('time')}
            className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors">
            <span className="text-sm font-semibold text-primary">
              {fmtDateLong(selDate)} — выбрать время
            </span>
            <ArrowRight className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>
    )
  }

  // ── Phase: TIME ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Назад к дате */}
      <button type="button" onClick={() => setPhase('date')}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        {selDate ? fmtDateLong(selDate) : 'Выбрать дату'}
      </button>

      {/* Время — сетка слотов от открытия до закрытия */}
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Время начала</p>
          {timePicked && (
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-900 tabular-nums">{startTime}</span>
              {showDuration && endTime ? <span className="text-gray-400"> → {endTime}</span> : null}
            </p>
          )}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {timeSlots.map(t => {
            const active = timePicked && startTime === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setStartTime(t); setTimePicked(true) }}
                className={`py-2 rounded-lg text-sm font-semibold tabular-nums border transition-colors
                  ${active ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-700 hover:border-primary/40 hover:bg-primary/5'}`}
              >
                {t}
              </button>
            )
          })}
        </div>
        {showDuration && timePicked && (
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Длительность · мастер занят ~{hoursLabel(durMin)}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setDurMin(m => Math.max(DUR_MIN, m - DUR_STEP))} disabled={durMin <= DUR_MIN}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 text-lg font-bold leading-none disabled:opacity-30">−</button>
              <span className="text-sm font-bold text-primary tabular-nums w-12 text-center">{hoursLabel(durMin)}</span>
              <button type="button" onClick={() => setDurMin(m => Math.min(DUR_MAX, m + DUR_STEP))} disabled={durMin >= DUR_MAX}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 text-lg font-bold leading-none disabled:opacity-30">+</button>
            </div>
          </div>
        )}
      </div>

      {/* Выбор мастера — после выбора времени */}
      {onWorkerChange && timePicked && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Мастер, который выполнит ремонт
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Не назначен */}
            <button
              type="button"
              onClick={() => onWorkerChange(null)}
              className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm font-medium transition-all
                ${!workerId
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold flex-shrink-0">—</span>
              Не назначен
            </button>

            {(workers as any[]).map(w => {
              const name = w.full_name || w.email?.split('@')[0] || 'Без имени'
              const active = workerId === w.id
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onWorkerChange(w.id)}
                  className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm font-medium transition-all
                    ${active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                >
                  <span
                    className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(w.id) }}
                  >
                    {initials(w.full_name || w.email)}
                  </span>
                  <span className="truncate max-w-[140px]">{name}</span>
                </button>
              )
            })}
          </div>
          {workers.length === 0 && (
            <p className="text-xs text-gray-400">Нет доступных мастеров</p>
          )}
        </div>
      )}
    </div>
  )
}
