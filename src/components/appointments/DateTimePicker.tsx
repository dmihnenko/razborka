import { useState, useMemo, useEffect, useRef } from 'react'
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
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function toLocalISO(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

function parseLocalISO(str: string | null | undefined): Date | null {
  if (!str) return null
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), 0, 0)
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h} ч`
  return `${h} ч ${m} мин`
}

function fmtDate(d: Date): string {
  const DAYS = ['вс','пн','вт','ср','чт','пт','сб']
  const MONTHS = ['января','февраля','марта','апреля','мая','июня',
                  'июля','августа','сентября','октября','ноября','декабря']
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// Слоты с 08:00 до 20:00 по 30 мин
const SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
})

const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                   'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDay(y: number, m: number) {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}

// ─── component ────────────────────────────────────────────────────────────────

export default function DateTimePicker({
  value, onChange, endValue, onEndChange, stoCompanyId, excludeAppointmentId,
}: Props) {
  const now = new Date()
  const selected = parseLocalISO(value)

  const [phase, setPhase] = useState<'date' | 'time'>(selected ? 'time' : 'date')
  const [viewYear, setViewYear]   = useState(selected?.getFullYear()  ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth()     ?? now.getMonth())
  const [selDate, setSelDate]     = useState<Date | null>(selected)

  const timeListRef = useRef<HTMLDivElement>(null)

  // Подгрузка занятости месяца
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
    staleTime: 2 * 60 * 1000,
  })

  // Загруженность по дням
  const dayLoad = useMemo(() => {
    const map: Record<number, number> = {}
    monthAppts.forEach((a: any) => {
      if (excludeAppointmentId && a.id === excludeAppointmentId) return
      map[new Date(a.scheduled_date).getDate()] = (map[new Date(a.scheduled_date).getDate()] || 0) + 1
    })
    return map
  }, [monthAppts, excludeAppointmentId])

  // Занятые слоты выбранного дня
  const takenSlots = useMemo(() => {
    if (!selDate) return new Set<string>()
    return new Set(
      monthAppts
        .filter((a: any) => {
          if (excludeAppointmentId && a.id === excludeAppointmentId) return false
          const d = new Date(a.scheduled_date)
          return d.getFullYear() === selDate.getFullYear() &&
                 d.getMonth()    === selDate.getMonth()    &&
                 d.getDate()     === selDate.getDate()
        })
        .map((a: any) => {
          const d = new Date(a.scheduled_date)
          const h = String(d.getHours()).padStart(2,'0')
          const m = String(d.getMinutes()).padStart(2,'0')
          return `${h}:${m}`
        })
    )
  }, [monthAppts, selDate, excludeAppointmentId])

  // Текущие выбранные времена
  const startTime = selected && selDate &&
    selected.getDate() === selDate.getDate() && selected.getMonth() === selDate.getMonth()
    ? `${String(selected.getHours()).padStart(2,'0')}:${String(selected.getMinutes()).padStart(2,'0')}`
    : null

  const endDate = parseLocalISO(endValue)
  const endTime = endDate && selDate &&
    endDate.getDate() === selDate.getDate() && endDate.getMonth() === selDate.getMonth()
    ? `${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`
    : null

  const startIdx = startTime ? SLOTS.indexOf(startTime) : -1
  const endIdx   = endTime   ? SLOTS.indexOf(endTime)   : -1

  const durationMin = startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
    ? (endIdx - startIdx) * 30
    : null

  // Скроллим к активному слоту при открытии
  useEffect(() => {
    if (phase === 'time' && startIdx !== -1 && timeListRef.current) {
      const el = timeListRef.current.children[Math.max(0, startIdx - 2)] as HTMLElement
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [phase, startIdx])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const prevMonth = () => viewMonth === 0
    ? (setViewYear(y => y - 1), setViewMonth(11))
    : setViewMonth(m => m - 1)
  const nextMonth = () => viewMonth === 11
    ? (setViewYear(y => y + 1), setViewMonth(0))
    : setViewMonth(m => m + 1)

  const handleDayClick = (day: number) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const dayDate = new Date(viewYear, viewMonth, day)
    if (dayDate < today) return

    const h = selected ? selected.getHours()   : 9
    const m = selected ? selected.getMinutes() : 0
    const dt = new Date(viewYear, viewMonth, day, h, m, 0, 0)
    setSelDate(new Date(viewYear, viewMonth, day, 0, 0, 0, 0))
    onChange(toLocalISO(dt))
    // Переходим к выбору времени
    setTimeout(() => setPhase('time'), 80)
  }

  const handleSlotClick = (slot: string) => {
    if (!selDate || takenSlots.has(slot)) return
    const [h, m] = slot.split(':').map(Number)
    const clickedIdx = SLOTS.indexOf(slot)

    if (onEndChange) {
      if (startIdx === -1 || clickedIdx <= startIdx) {
        // Устанавливаем начало, сбрасываем конец
        const dt = new Date(selDate); dt.setHours(h, m, 0, 0)
        onChange(toLocalISO(dt))
        onEndChange(null)
      } else {
        // Устанавливаем конец диапазона
        const dt = new Date(selDate); dt.setHours(h, m, 0, 0)
        onEndChange(toLocalISO(dt))
      }
    } else {
      const dt = new Date(selDate); dt.setHours(h, m, 0, 0)
      onChange(toLocalISO(dt))
    }
  }

  const today = new Date(); today.setHours(0,0,0,0)
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDay(viewYear, viewMonth)

  function loadColor(n: number) {
    if (n <= 2) return 'bg-emerald-400'
    if (n <= 5) return 'bg-amber-400'
    return 'bg-red-400'
  }

  // ── Phase: DATE ─────────────────────────────────────────────────────────────
  if (phase === 'date') {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Навигация по месяцу */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-bold text-gray-900">
              {MONTHS_RU[viewMonth]} {viewYear}
            </span>
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
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0)
              const isPast     = d < today
              const isToday    = d.getTime() === today.getTime()
              const isSel      = selDate && selDate.getDate() === day && selDate.getMonth() === viewMonth && selDate.getFullYear() === viewYear
              const load       = dayLoad[day] || 0
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
            {[['bg-emerald-400','1–2'],['bg-amber-400','3–5'],['bg-red-400','6+']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${c}`} />
                <span className="text-[11px] text-gray-500">{l}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Если дата уже выбрана — показать кнопку перехода к времени */}
        {selDate && (
          <button
            type="button"
            onClick={() => setPhase('time')}
            className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
          >
            <span className="text-sm font-semibold text-primary">
              {fmtDate(selDate)} — выбрать время
            </span>
            <ArrowRight className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>
    )
  }

  // ── Phase: TIME ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Назад к дате */}
      <button
        type="button"
        onClick={() => setPhase('date')}
        className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors -mt-1"
      >
        <ChevronLeft className="w-4 h-4" />
        {selDate ? fmtDate(selDate) : 'Выбрать дату'}
      </button>

      {/* Сводка выбранного времени */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <p className="text-[11px] font-medium text-gray-400 mb-1">Начало</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
              {startTime ?? '—'}
            </p>
          </div>

          <ArrowRight className="w-5 h-5 text-gray-300 flex-shrink-0" />

          <div className="flex-1 text-center">
            <p className="text-[11px] font-medium text-gray-400 mb-1">Конец</p>
            <p className={`text-2xl font-bold tabular-nums leading-none ${endTime ? 'text-gray-900' : 'text-gray-300'}`}>
              {endTime ?? '—'}
            </p>
          </div>

          {durationMin !== null && (
            <>
              <div className="w-px h-10 bg-gray-100 flex-shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-[11px] font-medium text-gray-400 mb-1">Длительность</p>
                <p className="text-base font-bold text-green-600 leading-none">
                  {fmtDuration(durationMin)}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Подсказка */}
        <p className="text-[11px] text-gray-400 mt-3 text-center">
          {startIdx === -1
            ? 'Нажмите на время начала записи'
            : endIdx === -1
              ? 'Теперь выберите время окончания'
              : 'Нажмите на другое начало чтобы изменить'}
        </p>
      </div>

      {/* Timeline слотов */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Расписание</span>
          <span className="text-xs text-gray-400">08:00 – 20:00</span>
        </div>

        <div ref={timeListRef} className="overflow-y-auto max-h-[340px]">
          {SLOTS.map((slot, idx) => {
            const isTaken   = takenSlots.has(slot)
            const isStart   = startTime === slot
            const isEnd     = endTime === slot
            const isInRange = startIdx !== -1 && endIdx !== -1 && idx > startIdx && idx < endIdx
            const isActive  = isStart || isEnd

            return (
              <button
                key={slot}
                type="button"
                onClick={() => handleSlotClick(slot)}
                disabled={isTaken}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all
                  ${isActive
                    ? 'bg-primary text-white'
                    : isInRange
                      ? 'bg-primary/10 text-primary'
                      : isTaken
                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        : 'hover:bg-gray-50 text-gray-700'
                  }
                  border-b border-gray-50 last:border-0`}
              >
                {/* Время */}
                <span className={`w-11 text-sm font-bold tabular-nums flex-shrink-0
                  ${isActive ? 'text-white' : isInRange ? 'text-primary' : isTaken ? 'text-gray-300' : 'text-gray-700'}`}>
                  {slot}
                </span>

                {/* Визуальная полоска */}
                <div className="flex-1 h-2 rounded-sm overflow-hidden bg-gray-100">
                  {isActive && <div className="h-full bg-white/50" />}
                  {isInRange && <div className="h-full bg-primary/40" />}
                  {isTaken && <div className="h-full bg-gray-200" />}
                </div>

                {/* Метка */}
                <span className={`text-[10px] font-bold flex-shrink-0 w-12 text-right
                  ${isActive ? 'text-white' : isInRange ? 'text-primary/70' : 'text-transparent'}`}>
                  {isStart ? 'начало' : isEnd ? 'конец' : isInRange ? '·' : isTaken ? 'занято' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
