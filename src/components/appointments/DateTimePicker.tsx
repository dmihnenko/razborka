import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  value: string // ISO datetime
  onChange: (value: string) => void
  stoCompanyId?: string | null
  excludeAppointmentId?: string // для редактирования — исключаем текущую запись
}

const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8
  const min = i % 2 === 0 ? '00' : '30'
  if (hour > 20) return null
  return `${String(hour).padStart(2, '0')}:${min}`
}).filter(Boolean) as string[]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Mon=0
}

export default function DateTimePicker({ value, onChange, stoCompanyId, excludeAppointmentId }: Props) {
  const now = new Date()
  const selected = value ? new Date(value) : null

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

  const selectedTime = selected && selectedDate && 
    selected.getDate() === selectedDate.getDate() &&
    selected.getMonth() === selectedDate.getMonth()
    ? `${String(selected.getHours()).padStart(2,'0')}:${String(selected.getMinutes()).padStart(2,'0')}`
    : null

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (day: number) => {
    const date = new Date(viewYear, viewMonth, day, 9, 0, 0)
    const today = new Date(); today.setHours(0,0,0,0)
    if (date < today) return
    setSelectedDate(date)
    // Если уже есть время — сохраняем его
    if (selected && selectedDate) {
      date.setHours(selected.getHours(), selected.getMinutes())
    }
    onChange(date.toISOString().slice(0, 16))
  }

  const handleTimeClick = (time: string) => {
    if (!selectedDate) return
    const [h, m] = time.split(':').map(Number)
    const date = new Date(selectedDate)
    date.setHours(h, m, 0, 0)
    onChange(date.toISOString().slice(0, 16))
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
              <span className="ml-auto text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                {selectedTime}
              </span>
            )}
          </div>
          <div className="p-3 grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {TIME_SLOTS.map(slot => {
              const isTaken = takenSlots.has(slot)
              const isCurrentSelected = selectedTime === slot
              return (
                <button key={slot} type="button"
                  onClick={() => !isTaken && handleTimeClick(slot)}
                  disabled={isTaken}
                  className={`h-10 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                    isCurrentSelected ? 'bg-indigo-600 text-white shadow-sm' :
                    isTaken ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through' :
                    'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-transparent'
                  }`}>
                  {isCurrentSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                  {slot}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
