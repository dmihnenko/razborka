import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  value: string // ISO datetime (start)
  onChange: (value: string) => void
  endValue?: string | null // ISO datetime (end, optional)
  onEndChange?: (value: string | null) => void
  stoCompanyId?: string | null
  excludeAppointmentId?: string // для редактирования — исключаем текущую запись
}

// Форматирует Date в локальный ISO-строку YYYY-MM-DDTHH:MM (без UTC-конвертации)
function toLocalISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Парсит локальный ISO-строку как ЛОКАЛЬНОЕ время (new Date(str) может интерпретировать как UTC в некоторых браузерах)
function parseLocalISO(str: string | null | undefined): Date | null {
  if (!str) return null
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), 0, 0)
}

const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => {
  const hour = i + 8 // 08:00 — 20:00
  return `${String(hour).padStart(2, '0')}:00`
})

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Mon=0
}

export default function DateTimePicker({ value, onChange, endValue, onEndChange, stoCompanyId, excludeAppointmentId }: Props) {
  const now = new Date()
  const selected = parseLocalISO(value)

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? now.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(selected)

  // Загружаем занятость месяца
  const { data: monthAppointments = [] } = useQuery({
    queryKey: ['appointments-month', stoCompanyId, viewYear, viewMonth],
    queryFn: async () => {
      if (!stoCompanyId) return []
      const from = new Date(viewYear, viewMonth, 1).toISOString()
      const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString()
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

  // Занятость по дням
  const dayLoad = useMemo(() => {
    const map: Record<number, number> = {}
    monthAppointments.forEach((a: any) => {
      if (excludeAppointmentId && a.id === excludeAppointmentId) return
      const d = new Date(a.scheduled_date).getDate()
      map[d] = (map[d] || 0) + 1
    })
    return map
  }, [monthAppointments, excludeAppointmentId])

  // Занятые слоты выбранного дня
  const takenSlots = useMemo(() => {
    if (!selectedDate) return new Set<string>()
    const dayAppts = monthAppointments.filter((a: any) => {
      if (excludeAppointmentId && a.id === excludeAppointmentId) return false
      const d = new Date(a.scheduled_date)
      return d.getFullYear() === selectedDate.getFullYear() &&
             d.getMonth() === selectedDate.getMonth() &&
             d.getDate() === selectedDate.getDate()
    })
    return new Set(dayAppts.map((a: any) => {
      const d = new Date(a.scheduled_date)
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }))
  }, [monthAppointments, selectedDate, excludeAppointmentId])

  const selectedEnd = parseLocalISO(endValue)

  const selectedTime = selected && selectedDate && 
    selected.getDate() === selectedDate.getDate() &&
    selected.getMonth() === selectedDate.getMonth()
    ? `${String(selected.getHours()).padStart(2,'0')}:${String(selected.getMinutes()).padStart(2,'0')}`
    : null

  const selectedEndTime = selectedEnd && selectedDate &&
    selectedEnd.getDate() === selectedDate.getDate() &&
    selectedEnd.getMonth() === selectedDate.getMonth()
    ? `${String(selectedEnd.getHours()).padStart(2,'0')}:${String(selectedEnd.getMinutes()).padStart(2,'0')}`
    : null

  // Индексы слотов начала и конца в массиве TIME_SLOTS
  const startIdx = selectedTime ? TIME_SLOTS.indexOf(selectedTime) : -1
  const endIdx = selectedEndTime ? TIME_SLOTS.indexOf(selectedEndTime) : -1

  // Длительность в часах и минутах
  const durationLabel = startIdx !== -1 && endIdx !== -1 && endIdx > startIdx ? (() => {
    const totalMins = (endIdx - startIdx) * 30
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return h > 0 ? (m > 0 ? `${h} ч ${m} мин` : `${h} ч`) : `${m} мин`
  })() : null

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (day: number) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const dayStart = new Date(viewYear, viewMonth, day)
    if (dayStart < today) return
    // Сохраняем уже выбранное время, иначе 9:00 по умолчанию
    const h = selected ? selected.getHours() : 9
    const m = selected ? selected.getMinutes() : 0
    const date = new Date(viewYear, viewMonth, day, h, m, 0, 0)
    setSelectedDate(new Date(date)) // не мутируем объект после setSelectedDate
    onChange(toLocalISO(date))
  }

  const handleTimeClick = (time: string) => {
    if (!selectedDate) return
    const [h, m] = time.split(':').map(Number)
    const clickedIdx = TIME_SLOTS.indexOf(time)

    if (onEndChange) {
      // Режим range-выбора
      if (startIdx === -1 || clickedIdx <= startIdx) {
        // Ещё нет начала или клик раньше/равно начала — меняем старт, сбрасываем конец
        const date = new Date(selectedDate)
        date.setHours(h, m, 0, 0)
        onChange(toLocalISO(date))
        onEndChange(null)
      } else {
        // Клик после начала — устанавливаем конец диапазона
        const date = new Date(selectedDate)
        date.setHours(h, m, 0, 0)
        onEndChange(toLocalISO(date))
      }
    } else {
      // Обычный одиночный выбор
      const date = new Date(selectedDate)
      date.setHours(h, m, 0, 0)
      onChange(toLocalISO(date))
    }
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const today = new Date()
  today.setHours(0,0,0,0)

  function getDayColor(count: number): string {
    if (count === 0) return ''
    if (count <= 2) return 'bg-emerald-400'
    if (count <= 5) return 'bg-amber-400'
    return 'bg-red-400'
  }

  return (
    <div className="space-y-4">
      {/* Календарь */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Навигация по месяцу */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button type="button" onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" strokeWidth={2} />
          </button>
          <span className="text-sm font-bold text-gray-900">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" strokeWidth={2} />
          </button>
        </div>

        {/* Дни недели */}
        <div className="grid grid-cols-7 px-3 py-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Дни месяца */}
        <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const date = new Date(viewYear, viewMonth, day)
            date.setHours(0,0,0,0)
            const isPast = date < today
            const isToday = date.getTime() === today.getTime()
            const isSelected = selectedDate &&
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === viewMonth &&
              selectedDate.getFullYear() === viewYear
            const load = dayLoad[day] || 0

            return (
              <button key={day} type="button"
                onClick={() => !isPast && handleDayClick(day)}
                disabled={isPast}
                className={`relative flex flex-col items-center justify-center h-10 rounded-xl text-sm font-medium transition-all ${
                  isSelected ? 'bg-indigo-600 text-white shadow-sm' :
                  isToday ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300' :
                  isPast ? 'text-gray-300 cursor-not-allowed' :
                  'text-gray-700 hover:bg-gray-100'
                }`}>
                <span>{day}</span>
                {/* Индикатор загруженности */}
                {!isPast && load > 0 && (
                  <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : getDayColor(load)}`} />
                )}
              </button>
            )
          })}
        </div>

        {/* Легенда */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <span className="text-[11px] text-gray-400 font-medium">Загруженность:</span>
          {[['bg-emerald-400', '1-2'], ['bg-amber-400', '3-5'], ['bg-red-400', '6+']].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-[11px] text-gray-500">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Выбор времени */}
      {selectedDate && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" strokeWidth={1.5} />
            <span className="text-sm font-bold text-gray-800">Время записи</span>
            {selectedTime && (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {selectedTime}{selectedEndTime ? ` – ${selectedEndTime}` : ''}
                </span>
                {durationLabel && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                    {durationLabel}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Подсказка: 1-й клик — начало, 2-й — конец */}
          {onEndChange && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              {startIdx === -1 || !selectedTime ? (
                <p className="text-[11px] text-gray-500">
                  Кликните на <strong>время начала</strong> — можно выбрать 1 час или диапазон
                </p>
              ) : endIdx === -1 ? (
                <p className="text-[11px] text-indigo-500 font-medium">
                  Начало: <strong>{selectedTime}</strong> — теперь кликните на <strong>время окончания</strong>
                </p>
              ) : (
                <p className="text-[11px] text-emerald-600 font-medium">
                  Выбрано: <strong>{selectedTime} – {selectedEndTime}</strong> · <strong>{durationLabel}</strong> · кликните начало чтобы изменить
                </p>
              )}
            </div>
          )}

          <div className="p-3 grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {TIME_SLOTS.map((slot, idx) => {
              const isTaken = takenSlots.has(slot)
              const isStart = selectedTime === slot
              const isEnd = selectedEndTime === slot
              const isInRange = startIdx !== -1 && endIdx !== -1 && idx > startIdx && idx < endIdx
              const isCurrentSelected = isStart || isEnd
              return (
                <button key={slot} type="button"
                  onClick={() => !isTaken && handleTimeClick(slot)}
                  disabled={isTaken}
                  className={`h-10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                    isCurrentSelected ? 'bg-indigo-600 text-white shadow-sm' :
                    isInRange ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                    isTaken ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through' :
                    'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-transparent'
                  }`}>
                  {isCurrentSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                  {slot}
                </button>
              )
            })}
          </div>

          {/* Итог: выбранный диапазон и количество часов */}
          {selectedTime && durationLabel && (
            <div className="px-4 py-3 border-t border-gray-100 bg-emerald-50/60 flex items-center justify-between">
              <span className="text-xs text-gray-600">
                <span className="font-semibold text-indigo-700">{selectedTime}</span>
                {selectedEndTime && (
                  <> → <span className="font-semibold text-indigo-700">{selectedEndTime}</span></>
                )}
              </span>
              <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-3 py-0.5 rounded-full">
                ⏱ {durationLabel}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
