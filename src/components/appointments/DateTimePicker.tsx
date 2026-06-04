import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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

// ─── data ─────────────────────────────────────────────────────────────────────

// Время начала: каждые 30 мин с 08:00 до 19:30
const START_TIMES = Array.from({ length: 24 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30
  const h = Math.floor(totalMin / 60), m = totalMin % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
})

// Длительность: от 30 мин до 8 ч по 30 мин
const DURATIONS: { label: string; min: number }[] = [
  { label: '30 мин', min: 30  },
  { label: '1 ч',    min: 60  },
  { label: '1 ч 30', min: 90  },
  { label: '2 ч',    min: 120 },
  { label: '2 ч 30', min: 150 },
  { label: '3 ч',    min: 180 },
  { label: '3 ч 30', min: 210 },
  { label: '4 ч',    min: 240 },
  { label: '4 ч 30', min: 270 },
  { label: '5 ч',    min: 300 },
  { label: '6 ч',    min: 360 },
  { label: '7 ч',    min: 420 },
  { label: '8 ч',    min: 480 },
]

const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                   'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function getFirstDay(y: number, m: number) {
  const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1
}

// ─── ScrollDrum ───────────────────────────────────────────────────────────────
// iOS-style drum scroll picker

const ITEM_H = 48  // px per item
const VISIBLE = 5  // видимых элементов (нечётное — центральный = выбранный)

interface DrumProps<T> {
  items: T[]
  value: T
  onChange: (v: T) => void
  getLabel: (v: T) => string
}

function ScrollDrum<T>({ items, value, onChange, getLabel }: DrumProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const selectedIdx = items.indexOf(value)

  // Инициализация позиции
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = selectedIdx * ITEM_H
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const snap = useCallback(() => {
    if (!ref.current) return
    const idx = Math.max(0, Math.min(items.length - 1,
      Math.round(ref.current.scrollTop / ITEM_H)
    ))
    ref.current.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
    onChange(items[idx])
  }, [items, onChange])

  const onScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(snap, 120)
  }

  const goTo = (idx: number) => {
    if (!ref.current) return
    ref.current.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
    onChange(items[idx])
  }

  return (
    <div className="relative overflow-hidden select-none" style={{ height: ITEM_H * VISIBLE }}>
      {/* Верхняя затухающая рамка */}
      <div className="absolute inset-x-0 top-0 z-10 pointer-events-none"
           style={{ height: ITEM_H * 2, background: 'linear-gradient(to bottom, white 0%, rgba(255,255,255,0.6) 100%)' }} />
      {/* Нижняя */}
      <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
           style={{ height: ITEM_H * 2, background: 'linear-gradient(to top, white 0%, rgba(255,255,255,0.6) 100%)' }} />
      {/* Рамка выбранного элемента */}
      <div className="absolute inset-x-3 z-10 pointer-events-none rounded-lg border-2 border-primary/20 bg-primary/5"
           style={{ top: ITEM_H * 2, height: ITEM_H }} />

      {/* Прокручиваемый список */}
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full overflow-y-scroll"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Отступ сверху чтобы первый элемент мог оказаться по центру */}
        <div style={{ height: ITEM_H * 2 }} />

        {items.map((item, idx) => {
          const isActive = item === value
          return (
            <div
              key={idx}
              onClick={() => goTo(idx)}
              style={{ height: ITEM_H }}
              className={`flex items-center justify-center cursor-pointer transition-all px-2
                ${isActive
                  ? 'text-primary font-bold text-base'
                  : 'text-gray-400 font-medium text-sm'}`}
            >
              {getLabel(item)}
            </div>
          )
        })}

        {/* Отступ снизу */}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DateTimePicker({
  value, onChange, endValue, onEndChange, stoCompanyId, excludeAppointmentId,
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

  // Выбранная длительность
  const [durMin, setDurMin] = useState<number>(() => {
    const end = parseLocalISO(endValue)
    if (end && selectedStart) {
      const diff = Math.round((end.getTime() - selectedStart.getTime()) / 60_000)
      const found = DURATIONS.find(d => d.min === diff)
      return found ? found.min : 60
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

  const durObj = DURATIONS.find(d => d.min === durMin) ?? DURATIONS[1]

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

      {/* Сводка: начало + длительность = конец */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-center">
          <div className="flex-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Начало</p>
            <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{startTime}</p>
          </div>

          <div className="text-gray-300 font-light text-xl flex-shrink-0">+</div>

          <div className="flex-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Длительность</p>
            <p className="text-xl font-bold text-primary leading-none">{durObj.label}</p>
          </div>

          <div className="text-gray-300 font-light text-xl flex-shrink-0">=</div>

          <div className="flex-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Конец</p>
            <p className="text-3xl font-bold text-green-600 tabular-nums leading-none">{endTime ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Барабанные колонки */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Время начала */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center py-2.5 border-b border-gray-100">
              Время начала
            </p>
            <ScrollDrum
              items={START_TIMES}
              value={startTime}
              onChange={setStartTime}
              getLabel={v => v}
            />
          </div>

          {/* Длительность */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center py-2.5 border-b border-gray-100">
              Длительность
            </p>
            <ScrollDrum
              items={DURATIONS.map(d => d.min)}
              value={durMin}
              onChange={setDurMin}
              getLabel={min => DURATIONS.find(d => d.min === min)?.label ?? ''}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
