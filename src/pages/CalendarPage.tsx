import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Plus, User, Car, Clock,
  Wrench, FileText, CalendarDays, ArrowLeft,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate, Link } from 'react-router-dom'
import AppointmentModal from '@/components/appointments/AppointmentModal'

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  scheduled:       { dot: '#7C3AED', bg: '#F5F3FF', text: '#7C3AED', label: 'Запланирована' },
  in_progress:     { dot: '#D97706', bg: '#FFFBEB', text: '#D97706', label: 'В работе' },
  ready:           { dot: '#16A34A', bg: '#F0FDF4', text: '#16A34A', label: 'Готова' },
  completed:       { dot: '#2563EB', bg: '#EFF6FF', text: '#2563EB', label: 'Завершена' },
  archived:        { dot: '#94A3B8', bg: '#F8FAFC', text: '#64748B', label: 'Архив' },
  cancelled:       { dot: '#DC2626', bg: '#FEF2F2', text: '#DC2626', label: 'Отменена' },
  pending_deletion:{ dot: '#B91C1C', bg: '#FEF2F2', text: '#B91C1C', label: 'Удаление' },
}

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const WEEKDAY_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseLocalISO(str: string | null | undefined): Date | null {
  if (!str) return null
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 9), +(m[5] ?? 0), 0, 0)
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfMonth(y: number, m: number) {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}
function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
  if ([2,3,4].includes(mod10) && ![12,13,14].includes(mod100)) return `${n} ${few}`
  return `${n} ${many}`
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const now = new Date()
  const todayY = now.getFullYear(), todayM = now.getMonth(), todayD = now.getDate()
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)

  const [viewYear, setViewYear] = useState(todayY)
  const [viewMonth, setViewMonth] = useState(todayM)
  const [selectedDay, setSelectedDay] = useState<number | null>(todayD)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [modalPrefilledDate, setModalPrefilledDate] = useState<string | undefined>()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }
  const goToday = () => {
    setViewYear(todayY); setViewMonth(todayM)
    setSelectedDay(todayD)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const handleSelectDay = (day: number) => {
    const next = day === selectedDay ? null : day
    setSelectedDay(next)
    if (next) setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const openNewModal = (date?: string) => {
    setModalPrefilledDate(date)
    setIsNewModalOpen(true)
  }

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['calendar-page', profile?.sto_company_id, viewYear, viewMonth],
    queryFn: async () => {
      const from = new Date(viewYear, viewMonth, 1).toISOString()
      const to   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString()
      const { data, error } = await supabase
        .from('appointments')
        .select(`id, status, scheduled_date, notes,
          customers(id, name, phone),
          vehicles(id, brand, model, license_plate),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)`)
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
    for (const appt of appointments as any[]) {
      const d = parseLocalISO(appt.scheduled_date)
      if (!d) continue
      const day = d.getDate()
      if (!map[day]) map[day] = []
      map[day].push({ ...appt, _date: d })
    }
    return map
  }, [appointments])

  const selectedAppts: any[] = selectedDay ? (byDay[selectedDay] ?? []) : []
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDayOfMonth(viewYear, viewMonth)
  const today       = new Date(todayY, todayM, todayD)
  const isCurrentMonth = viewYear === todayY && viewMonth === todayM

  // Month-level stats
  const stats = useMemo(() => {
    const active = (appointments as any[]).filter(a => !['archived','cancelled','deleted'].includes(a.status))
    return {
      total: active.length,
      inProgress: active.filter(a => a.status === 'in_progress').length,
      ready: active.filter(a => ['ready','completed'].includes(a.status)).length,
    }
  }, [appointments])

  // Selected day info
  const selDate = selectedDay ? new Date(viewYear, viewMonth, selectedDay) : null
  const selWeekday = selDate ? WEEKDAY_FULL[selDate.getDay()] : ''

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-3 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CalendarDays className="w-5 h-5 text-primary flex-shrink-0" />
            <h1 className="font-bold text-gray-900 text-base sm:text-lg truncate">Календарь</h1>
          </div>
          <button onClick={() => openNewModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Новая запись</span>
          </button>
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4">

        {/* ── Calendar card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Month nav + stats */}
          <div className="px-4 sm:px-5 pt-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <button onClick={prevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>

              <div className="flex-1 text-center">
                <p className="font-bold text-gray-900 text-base sm:text-lg">
                  {MONTHS[viewMonth]} {viewYear}
                </p>
                {stats.total > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {plural(stats.total, 'запись', 'записи', 'записей')}
                    {stats.inProgress > 0 && <> · <span style={{color:'#D97706'}}>{stats.inProgress} в работе</span></>}
                    {stats.ready > 0 && <> · <span style={{color:'#16A34A'}}>{stats.ready} готово</span></>}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!isCurrentMonth && (
                  <button onClick={goToday}
                    className="px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                    Сегодня
                  </button>
                )}
                <button onClick={nextMonth}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-4 sm:px-5 pb-1">
            {WEEKDAYS_SHORT.map((d, i) => (
              <div key={d} className={`text-center text-xs font-semibold py-1.5 ${i >= 5 ? 'text-red-400' : 'text-gray-400'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid — compact */}
          <div className="grid grid-cols-7 px-3 sm:px-4 pb-3 gap-0.5 sm:gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayAppts = byDay[day] ?? []
              const dayDate  = new Date(viewYear, viewMonth, day)
              const isToday  = dayDate.getTime() === today.getTime()
              const isPast   = dayDate < today
              const isSelected = selectedDay === day
              const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
              const count = dayAppts.length

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`relative flex flex-col items-center pt-1.5 pb-1.5 rounded-xl transition-all select-none
                    min-h-[52px] sm:min-h-[60px]
                    ${isSelected
                      ? 'bg-primary ring-2 ring-primary/30'
                      : isToday
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-gray-50 border border-transparent'
                    }`}
                >
                  {/* Day number */}
                  <span className={`text-xs sm:text-sm font-bold leading-none mb-1 ${
                    isSelected ? 'text-white' :
                    isToday    ? 'text-primary' :
                    isPast     ? (isWeekend ? 'text-red-300' : 'text-gray-350') :
                    isWeekend  ? 'text-red-400' : 'text-gray-700'
                  }`}
                    style={{ color: isPast && !isSelected && !isToday ? (isWeekend ? '' : '#9CA3AF') : undefined }}
                  >
                    {day}
                  </span>

                  {/* Status dots */}
                  {count > 0 && (
                    <div className="flex items-center gap-0.5 flex-wrap justify-center px-0.5">
                      {count <= 5
                        ? dayAppts.slice(0, 5).map((a: any, idx: number) => (
                            <span key={idx} className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : (STATUS_MAP[a.status]?.dot ?? '#94a3b8') }} />
                          ))
                        : <>
                            {dayAppts.slice(0, 3).map((a: any, idx: number) => (
                              <span key={idx} className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : (STATUS_MAP[a.status]?.dot ?? '#94a3b8') }} />
                            ))}
                            <span className={`text-[9px] font-bold leading-none ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                              +{count - 3}
                            </span>
                          </>
                      }
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Status legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            {Object.entries(STATUS_MAP).filter(([k]) => !['archived','pending_deletion','completed'].includes(k)).map(([status, cfg]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
                <span className="text-xs text-gray-500">{cfg.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Day panel ──────────────────────────────────────────────────── */}
        <div ref={listRef}>
          {selectedDay ? (
            <div className="space-y-3">
              {/* Day header */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 capitalize">
                    {selWeekday}, {selectedDay} {MONTHS_GEN[viewMonth]}
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {isLoading ? 'Загрузка...' :
                     selectedAppts.length === 0 ? 'Нет записей' :
                     plural(selectedAppts.length, 'запись', 'записи', 'записей')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const pad = (n: number) => String(n).padStart(2, '0')
                    openNewModal(`${viewYear}-${pad(viewMonth + 1)}-${pad(selectedDay!)}`)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Добавить</span>
                </button>
              </div>

              {/* Loading */}
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selectedAppts.length === 0 ? (
                /* Empty state */
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <FileText className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="font-medium text-gray-500 mb-1">Записей нет</p>
                  <p className="text-sm text-gray-400 mb-5">На этот день ничего не запланировано</p>
                  <button
                    onClick={() => {
                      const pad = (n: number) => String(n).padStart(2, '0')
                      openNewModal(`${viewYear}-${pad(viewMonth + 1)}-${pad(selectedDay!)}`)
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors">
                    <Plus className="w-4 h-4" />Создать запись
                  </button>
                </div>
              ) : (
                /* Appointment cards grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {selectedAppts.map((appt: any) => {
                    const sc = STATUS_MAP[appt.status] ?? STATUS_MAP.scheduled
                    const worker = appt.assigned_to_profile?.full_name
                      ?? appt.assigned_to_profile?.email?.split('@')[0]
                      ?? null
                    const time = fmtTime(appt._date)
                    const hasTime = appt._date.getHours() !== 9 || appt._date.getMinutes() !== 0

                    return (
                      <Link
                        key={appt.id}
                        to={`/sto/appointments/${appt.id}`}
                        className="group bg-white rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all overflow-hidden block"
                      >
                        {/* Color top stripe by status */}
                        <div className="h-1" style={{ backgroundColor: sc.dot }} />

                        <div className="p-4 sm:p-5">
                          {/* Time + status row */}
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: sc.bg }}>
                                <Clock className="w-4 h-4" style={{ color: sc.text }} />
                              </div>
                              <span className="text-lg font-bold text-gray-900 tabular-nums leading-none">
                                {hasTime ? time : '—'}
                              </span>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 border"
                              style={{ color: sc.text, backgroundColor: sc.bg, borderColor: sc.dot + '40' }}>
                              {sc.label}
                            </span>
                          </div>

                          {/* Customer */}
                          <div className="flex items-start gap-2.5 mb-2">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-primary transition-colors">
                              {appt.customers?.name ?? 'Клиент не указан'}
                            </p>
                          </div>

                          {/* Vehicle */}
                          {appt.vehicles && (
                            <div className="flex items-start gap-2.5 mb-2">
                              <Car className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                                <span className="text-sm text-gray-700">
                                  {appt.vehicles.brand} {appt.vehicles.model}
                                </span>
                                {appt.vehicles.license_plate && (
                                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {appt.vehicles.license_plate}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Worker */}
                          {worker && (
                            <div className="flex items-start gap-2.5 mb-2">
                              <Wrench className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-violet-600 font-medium">{worker}</span>
                            </div>
                          )}

                          {/* Notes */}
                          {appt.notes && (
                            <p className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 line-clamp-2 leading-relaxed italic">
                              {appt.notes}
                            </p>
                          )}
                        </div>

                        {/* Hover footer */}
                        <div className="px-4 sm:px-5 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-primary font-semibold">Открыть заявку</span>
                          <ChevronRight className="w-3.5 h-3.5 text-primary" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* No day selected prompt */
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-14 px-4 text-center">
              <CalendarDays className="w-12 h-12 text-gray-200 mb-3" />
              <p className="font-medium text-gray-500">Выберите день в календаре</p>
              <p className="text-sm text-gray-400 mt-1">Нажмите на любую дату чтобы увидеть записи</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => { setIsNewModalOpen(false); setModalPrefilledDate(undefined) }}
        prefilledDate={modalPrefilledDate}
      />
    </div>
  )
}

