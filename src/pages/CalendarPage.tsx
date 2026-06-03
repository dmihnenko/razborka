import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar, User, Car, Clock, FileText, Wrench, ArrowLeft, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate } from 'react-router-dom'
import AppointmentModal from '@/components/appointments/AppointmentModal'

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:        { bg: '#EDE9FE', text: '#7C3AED', label: 'Ожидает' },
  in_progress:      { bg: '#FEF3C7', text: '#D97706', label: 'В работе' },
  ready:            { bg: '#DCFCE7', text: '#16A34A', label: 'Готово' },
  completed:        { bg: '#DBEAFE', text: '#2563EB', label: 'Завершено' },
  archived:         { bg: '#F1F5F9', text: '#64748B', label: 'Архив' },
  cancelled:        { bg: '#FEE2E2', text: '#DC2626', label: 'Отменено' },
  pending_deletion: { bg: '#FEE2E2', text: '#B91C1C', label: 'Удаление' },
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
]
const MONTHS_GEN = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря',
]

function parseLocalISO(str: string | null | undefined): Date | null {
  if (!str) return null
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 9), Number(m[5] ?? 0), 0, 0)
}

function fmtTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

export default function CalendarPage() {
  const now = new Date()
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate())
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['calendar-page', profile?.sto_company_id, viewYear, viewMonth],
    queryFn: async () => {
      const from = new Date(viewYear, viewMonth, 1).toISOString()
      const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString()
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, status, scheduled_date, notes,
          customers(id, name, phone),
          vehicles(id, brand, model, license_plate),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)
        `)
        .eq('sto_company_id', profile!.sto_company_id!)
        .not('status', 'in', '(deleted)')
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile?.sto_company_id,
    staleTime: 60_000,
  })

  const byDay = useMemo(() => {
    const map: Record<number, any[]> = {}
    appointments.forEach((appt: any) => {
      const d = parseLocalISO(appt.scheduled_date)
      if (!d) return
      const day = d.getDate()
      if (!map[day]) map[day] = []
      map[day].push({ ...appt, _date: d })
    })
    return map
  }, [appointments])

  const selectedAppts: any[] = selectedDay ? (byDay[selectedDay] ?? []) : []

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}>
              Календарь записей
            </h1>
            <p className="text-sm mt-0.5 text-gray-500">Все записи по дням</p>
          </div>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="btn-primary btn-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Новая запись</span>
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-180px)]">

        {/* ── Left: Calendar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:w-[560px] xl:w-[640px] flex-shrink-0">

          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button type="button" onClick={prevMonth}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-base font-bold text-gray-900">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-4 py-2">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-4 pb-4 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayAppts = byDay[day] ?? []
              const dayDate = new Date(viewYear, viewMonth, day)
              const isToday = dayDate.getTime() === today.getTime()
              const isPast = dayDate < today
              const isSelected = selectedDay === day
              const hasAppts = dayAppts.length > 0

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`relative min-h-[80px] sm:min-h-[90px] rounded-xl p-1.5 text-left transition-all border ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100'
                      : isToday
                      ? 'bg-blue-50/60 border-blue-200'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-bold block mb-1 ${
                    isSelected ? 'text-indigo-700' :
                    isToday ? 'text-blue-600' :
                    isPast ? 'text-gray-400' : 'text-gray-700'
                  }`}>{day}</span>

                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map((appt: any) => {
                      const sc = STATUS_MAP[appt.status] ?? STATUS_MAP.scheduled
                      return (
                        <div key={appt.id}
                          className="text-[9px] leading-tight font-semibold px-1 py-0.5 rounded truncate"
                          style={{ backgroundColor: sc.bg, color: sc.text }}>
                          {fmtTime(appt._date)} {appt.customers?.name?.split(' ')[0] ?? '—'}
                        </div>
                      )
                    })}
                    {dayAppts.length > 3 && (
                      <div className="text-[9px] text-gray-400 font-medium px-0.5">
                        +{dayAppts.length - 3} ещё
                      </div>
                    )}
                  </div>

                  {hasAppts && (
                    <span className={`absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {dayAppts.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-[11px] text-gray-400 font-medium">Статусы:</span>
            {[
              { status: 'scheduled', label: 'Ожидает' },
              { status: 'in_progress', label: 'В работе' },
              { status: 'ready', label: 'Готово' },
              { status: 'archived', label: 'Архив' },
              { status: 'cancelled', label: 'Отменено' },
            ].map(({ status, label }) => {
              const sc = STATUS_MAP[status]
              return (
                <span key={status} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.text }} />
                  <span className="text-[11px] text-gray-500">{label}</span>
                </span>
              )
            })}
          </div>
        </div>

        {/* ── Right: Appointment list ── */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">

          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3 flex-shrink-0">
            <Calendar className="w-4 h-4 text-indigo-500" />
            {selectedDay ? (
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {selectedDay} {MONTHS_GEN[viewMonth]} {viewYear}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedAppts.length === 0 ? 'Нет записей' :
                   selectedAppts.length === 1 ? '1 запись' :
                   selectedAppts.length < 5 ? `${selectedAppts.length} записи` :
                   `${selectedAppts.length} записей`}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-gray-900">Записи дня</p>
                <p className="text-xs text-gray-400 mt-0.5">Выберите день в календаре</p>
              </div>
            )}
          </div>

          {/* Appointment cards */}
          <div className="flex-1 overflow-y-auto">
            {!selectedDay ? (
              <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                <Calendar className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">Нажмите на день в календаре</p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full py-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
              </div>
            ) : selectedAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                <FileText className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">Нет записей на этот день</p>
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="mt-4 btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Добавить запись
                </button>
              </div>
            ) : (
              <div className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 content-start">
                {selectedAppts.map((appt: any) => {
                  const sc = STATUS_MAP[appt.status] ?? STATUS_MAP.scheduled
                  const workerName = appt.assigned_to_profile?.full_name
                    ?? appt.assigned_to_profile?.email?.split('@')[0]
                    ?? null

                  return (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => navigate(`/sto/appointments/${appt.id}`)}
                      className="text-left p-4 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer"
                    >
                      {/* Time + status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm font-bold text-gray-900">
                            {fmtTime(appt._date)}
                          </span>
                        </div>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: sc.bg, color: sc.text }}
                        >
                          {sc.label}
                        </span>
                      </div>

                      {/* Client */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                          {appt.customers?.name ?? 'Клиент не указан'}
                        </span>
                      </div>

                      {/* Vehicle */}
                      {appt.vehicles && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-600 truncate">
                            {appt.vehicles.brand} {appt.vehicles.model}
                            {appt.vehicles.license_plate && (
                              <span className="ml-1.5 font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                                {appt.vehicles.license_plate}
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Master */}
                      {workerName && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <Wrench className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span className="text-xs text-indigo-600 font-medium truncate">{workerName}</span>
                        </div>
                      )}

                      {/* Notes */}
                      {appt.notes && (
                        <p className="mt-2 text-xs text-gray-400 line-clamp-2 italic leading-relaxed">
                          {appt.notes}
                        </p>
                      )}

                      <div className="mt-3 pt-2.5 border-t border-gray-100 text-[11px] text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Открыть заявку →
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New appointment modal */}
      <AppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />
    </div>
  )
}
