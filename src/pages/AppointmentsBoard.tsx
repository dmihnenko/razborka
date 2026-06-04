import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import {
  Plus, ChevronLeft, ChevronRight, LayoutGrid, CalendarDays,
  Calendar, User, Car, Clock, Wrench, ArrowRight,
  Archive, Search, X, List, Phone,
} from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import SubscriptionUpgradeModal from '@/components/SubscriptionUpgradeModal'
import { toast } from 'sonner'

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, {
  label: string; color: string; bg: string; border: string
  next?: string; nextLabel?: string
}> = {
  scheduled:        { label: 'Запланировано', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', next: 'in_progress', nextLabel: 'В работу' },
  in_progress:      { label: 'В работе',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', next: 'completed',   nextLabel: 'Готово' },
  completed:        { label: 'Готово',         color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', next: 'archived',   nextLabel: 'В архив' },
  ready:            { label: 'Готово',         color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', next: 'archived',   nextLabel: 'В архив' },
  archived:         { label: 'Архив',          color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  cancelled:        { label: 'Отменено',       color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  pending_deletion: { label: 'На удаление',    color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

const KANBAN_COLS = [
  { id: 'scheduled',   label: 'Запланировано', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { id: 'in_progress', label: 'В работе',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'completed',   label: 'Готово',         color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { id: 'archived',    label: 'Архив',          color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
]

const MOBILE_KANBAN_LABELS: Record<string, string> = {
  scheduled:   'План',
  in_progress: 'Раб',
  completed:   'Гот',
  archived:    'Арх',
}

const WEEKDAYS   = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const HOUR_RANGE = Array.from({ length: 13 }, (_, i) => i + 8) // 8..20

type View = 'kanban' | 'day' | 'week' | 'list'

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseLocal(str: string | null): Date | null {
  if (!str) return null
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2]-1, +m[3], +(m[4]??9), +(m[5]??0))
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function fmtDate(d: Date) {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function getWeekStart(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  r.setHours(0,0,0,0)
  return r
}
function fmtMoney(n: number) {
  return `₴${n.toLocaleString('ru-RU')}`
}
function totalCost(a: any) {
  return a.total_cost || (a.total_work_cost || 0) + (a.total_parts_cost || 0)
}

// ─── PaymentDot ───────────────────────────────────────────────────────────────

function PaymentDot({ appt }: { appt: any }) {
  const hasWork  = (appt.total_work_cost  || 0) > 0
  const hasParts = (appt.total_parts_cost || 0) > 0
  if (!hasWork && !hasParts) return null

  if (hasWork && hasParts) {
    if (appt.work_paid && appt.parts_paid)
      return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Оплачено полностью" />
    if (!appt.work_paid && !appt.parts_paid)
      return <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" title="Не оплачено" />
    return <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" title="Оплачено частично" />
  }

  const paid = (hasWork && appt.work_paid) || (hasParts && appt.parts_paid)
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${paid ? 'bg-green-500' : 'bg-red-400'}`}
      title={paid ? 'Оплачено' : 'Не оплачено'}
    />
  )
}

// ─── AppointmentCard ──────────────────────────────────────────────────────────

function AppointmentCard({
  appt, onStatusChange, showDate = false,
}: {
  appt: any
  onStatusChange: (id: string, status: string) => void
  showDate?: boolean
}) {
  const navigate   = useNavigate()
  const cfg        = STATUS_CFG[appt.status] ?? STATUS_CFG.scheduled
  const date       = parseLocal(appt.scheduled_date)
  const time       = date ? fmtTime(date) : '—'
  const cost       = totalCost(appt)
  const worksCount = appt.work_items?.length || appt.appointment_services?.length || 0
  const firstWork  = appt.work_items?.[0]?.name || appt.appointment_services?.[0]?.description
  const mechanic   = appt.assigned_to_profile?.full_name
  const phone      = appt.customers?.phone
  const hasWork    = (appt.total_work_cost  || 0) > 0
  const hasParts   = (appt.total_parts_cost || 0) > 0

  return (
    <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Левая цветная полоска */}
      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: cfg.color }} />

      <div className="flex-1 p-3 min-w-0">
        {/* Строка 1: время + статус + payment dot */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-bold text-gray-900 tabular-nums">{time}</span>
            {showDate && date && (
              <span className="text-[11px] text-gray-400">{fmtDate(date)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <PaymentDot appt={appt} />
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md border"
              style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Строка 2: клиент + телефон */}
        <div className="flex items-center gap-2 mb-1">
          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1">
            {appt.customers?.name || 'Клиент не указан'}
          </p>
          {phone && (
            <a
              href={`tel:${phone}`}
              onClick={e => e.stopPropagation()}
              className="flex-shrink-0 text-blue-600 hover:text-blue-500 transition-colors"
              title={phone}
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Строка 3: авто + гос. номер */}
        {appt.vehicles && (
          <div className="flex items-center gap-2 mb-1">
            <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-700 truncate flex-1">
              {appt.vehicles.brand} {appt.vehicles.model}
            </span>
            {appt.vehicles.license_plate && (
              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">
                {appt.vehicles.license_plate}
              </span>
            )}
          </div>
        )}

        {/* Строка 4: работы */}
        {firstWork && (
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <p className="text-xs text-gray-500 line-clamp-1 flex-1">
              {firstWork}{worksCount > 1 ? ` +${worksCount - 1}` : ''}
            </p>
          </div>
        )}

        {/* Строка 5: стоимость + механик */}
        <div className="flex items-center justify-between gap-2">
          {cost > 0 ? (
            <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtMoney(cost)}</span>
          ) : (
            <span className="text-xs text-gray-300">Без стоимости</span>
          )}
          {mechanic && (
            <span className="text-[10px] text-gray-400 truncate max-w-[90px]" title={mechanic}>
              {mechanic.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Строка 6: оплата badges */}
        {(hasWork || hasParts) && (
          <div className="flex gap-1.5 mt-1.5">
            {hasWork && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium
                ${appt.work_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                Работы {appt.work_paid ? '✓' : '—'}
              </span>
            )}
            {hasParts && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium
                ${appt.parts_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                Запчасти {appt.parts_paid ? '✓' : '—'}
              </span>
            )}
          </div>
        )}

        {/* Строка 7: action buttons */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
          {cfg.next && (
            <button
              onClick={e => { e.stopPropagation(); onStatusChange(appt.id, cfg.next!) }}
              className="flex-1 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all hover:opacity-90 active:scale-95"
              style={{
                color: STATUS_CFG[cfg.next!].color,
                borderColor: STATUS_CFG[cfg.next!].border,
                backgroundColor: STATUS_CFG[cfg.next!].bg,
              }}
            >
              {cfg.nextLabel}
            </button>
          )}
          <button
            onClick={() => navigate(`/sto/appointments/${appt.id}`)}
            className="p-2 text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-lg transition-all"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ListRow ──────────────────────────────────────────────────────────────────

function ListRow({ appt, onStatusChange }: { appt: any; onStatusChange: (id: string, status: string) => void }) {
  const navigate   = useNavigate()
  const cfg        = STATUS_CFG[appt.status] ?? STATUS_CFG.scheduled
  const date       = parseLocal(appt.scheduled_date)
  const cost       = totalCost(appt)
  const worksCount = appt.work_items?.length || appt.appointment_services?.length || 0
  const firstWork  = appt.work_items?.[0]?.name || appt.appointment_services?.[0]?.description
  const mechanic   = appt.assigned_to_profile?.full_name
  const phone      = appt.customers?.phone
  const hasWork    = (appt.total_work_cost  || 0) > 0
  const hasParts   = (appt.total_parts_cost || 0) > 0

  return (
    <div
      className="bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => navigate(`/sto/appointments/${appt.id}`)}
    >
      <div className="flex items-stretch">
        {/* Цветная левая полоска */}
        <div className="w-[3px] rounded-l-xl flex-shrink-0" style={{ backgroundColor: cfg.color }} />

        <div className="flex-1 px-3 py-3 min-w-0">
          <div className="flex items-center gap-3">

            {/* Дата / время */}
            <div className="flex-shrink-0 w-[4.5rem] text-center">
              {date ? (
                <>
                  <p className="text-[10px] text-gray-400 leading-tight">{fmtDate(date)}</p>
                  <p className="text-base font-bold text-gray-900 tabular-nums leading-tight">{fmtTime(date)}</p>
                </>
              ) : (
                <p className="text-xs text-gray-300">—</p>
              )}
            </div>

            {/* Клиент + авто */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                  {appt.customers?.name || 'Клиент не указан'}
                </p>
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    onClick={e => e.stopPropagation()}
                    className="text-blue-600 hover:text-blue-500 flex-shrink-0"
                    title={phone}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              {appt.vehicles && (
                <p className="text-xs text-gray-500 truncate">
                  {appt.vehicles.brand} {appt.vehicles.model}
                  {appt.vehicles.license_plate && (
                    <span className="ml-1.5 font-mono bg-gray-100 px-1 py-px rounded text-gray-600 text-[10px]">
                      {appt.vehicles.license_plate}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Работы + механик */}
            <div className="hidden md:block flex-1 min-w-0">
              {firstWork ? (
                <p className="text-xs text-gray-600 line-clamp-2 leading-tight">
                  {firstWork}{worksCount > 1 ? ` +${worksCount - 1}` : ''}
                </p>
              ) : (
                <p className="text-xs text-gray-300">Работы не указаны</p>
              )}
              {mechanic && (
                <p className="text-[10px] text-gray-400 mt-0.5">{mechanic}</p>
              )}
            </div>

            {/* Стоимость + оплата */}
            <div className="hidden sm:flex flex-col items-end flex-shrink-0 w-24 gap-0.5">
              {cost > 0 && (
                <p className="text-sm font-bold text-gray-900 tabular-nums">{fmtMoney(cost)}</p>
              )}
              {hasWork && (
                <span className={`text-[9px] px-1 py-0.5 rounded-md font-medium ${appt.work_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                  Работы {appt.work_paid ? '✓' : '—'}
                </span>
              )}
              {hasParts && (
                <span className={`text-[9px] px-1 py-0.5 rounded-md font-medium ${appt.parts_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                  Запчасти {appt.parts_paid ? '✓' : '—'}
                </span>
              )}
            </div>

            {/* Статус + кнопки */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap"
                style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
              >
                {cfg.label}
              </span>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {cfg.next && (
                  <button
                    onClick={() => onStatusChange(appt.id, cfg.next!)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border-2 transition-all hover:opacity-80 whitespace-nowrap hidden sm:block"
                    style={{ color: STATUS_CFG[cfg.next!].color, borderColor: STATUS_CFG[cfg.next!].border, backgroundColor: STATUS_CFG[cfg.next!].bg }}
                  >
                    {cfg.nextLabel}
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/sto/appointments/${appt.id}`) }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-lg transition-all"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Мобильная строка оплаты */}
          {(hasWork || hasParts) && (
            <div className="sm:hidden flex items-center gap-1.5 mt-1.5 pl-[calc(3px+1rem)]">
              {cost > 0 && (
                <span className="text-xs font-bold text-gray-900 tabular-nums">{fmtMoney(cost)}</span>
              )}
              {hasWork && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium
                  ${appt.work_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                  Р {appt.work_paid ? '✓' : '—'}
                </span>
              )}
              {hasParts && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium
                  ${appt.parts_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                  З {appt.parts_paid ? '✓' : '—'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({
  col, colAppts, colRev, onStatusChange, onNew,
}: {
  col: typeof KANBAN_COLS[number]
  colAppts: any[]
  colRev: number
  onStatusChange: (id: string, status: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-lg border"
        style={{ backgroundColor: col.bg, borderColor: col.border }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: col.color }}
          />
          <span className="text-sm font-bold text-gray-800">{col.label}</span>
          <span
            className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-white"
            style={{ color: col.color }}
          >
            {colAppts.length}
          </span>
        </div>
        {colRev > 0 && (
          <span className="text-xs font-bold tabular-nums" style={{ color: col.color }}>
            {fmtMoney(colRev)}
          </span>
        )}
      </div>

      {/* Cards */}
      {colAppts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
          <p className="text-xs font-medium">Нет записей</p>
          {col.id === 'scheduled' && (
            <button
              onClick={onNew}
              className="mt-2 text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Добавить
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {colAppts.map(appt => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              onStatusChange={onStatusChange}
              showDate
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── main board ──────────────────────────────────────────────────────────────

export default function AppointmentsBoard() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const { canCreate, usage, limits, hasSubscription, plan } = useSubscriptionLimits()
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const [searchParams] = useSearchParams()
  const [view, setView] = useState<View>(() => {
    const v = searchParams.get('view')
    return (v === 'day' || v === 'week' || v === 'list' || v === 'kanban') ? v : 'kanban'
  })
  const [selectedDate, setSelectedDate]         = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [weekStart, setWeekStart]               = useState(() => getWeekStart(new Date()))
  const [search, setSearch]                     = useState('')
  const [showArchived, setShowArchived]         = useState(false)
  const [mechanicFilter, setMechanicFilter]     = useState('all')
  const [listStatusFilter, setListStatusFilter] = useState('active')
  const [isNewModalOpen, setIsNewModalOpen]     = useState(false)
  const [newModalDate, setNewModalDate]         = useState<string | undefined>()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [mobileKanbanCol, setMobileKanbanCol]   = useState<string>('scheduled')
  const [weekMobileOffset, setWeekMobileOffset] = useState<0 | 3>(0)

  const currentHourRef = useRef<HTMLDivElement>(null)

  const stoId = profile?.sto_company_id

  // ── Прокрутка к текущему часу в day-вид ─────────────────────────────────
  useEffect(() => {
    if (view === 'day') {
      currentHourRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [view, selectedDate])

  // ── Kanban / List query ────────────────────────────────────────────────────
  const { data: kanbanAppts = [], isLoading: kanbanLoading } = useQuery({
    queryKey: ['board-kanban', stoId, showArchived],
    queryFn: async () => {
      let q = supabase
        .from('appointments')
        .select(`
          id, status, scheduled_date, notes,
          total_cost, total_work_cost, total_parts_cost,
          work_paid, parts_paid,
          work_items, part_items,
          appointment_services(id, description, cost),
          customers(id, name, phone),
          vehicles(id, brand, model, license_plate),
          assigned_to_profile:user_profiles!assigned_to(full_name)
        `)
        .eq('sto_company_id', stoId!)
        .not('status', 'in', '(deleted,pending_deletion)')
        .order('scheduled_date', { ascending: true })

      if (!showArchived) q = q.not('status', 'in', '(archived,cancelled)')

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!stoId,
    staleTime: 30_000,
  })

  // ── Day query ─────────────────────────────────────────────────────────────
  const { data: dayAppts = [], isLoading: dayLoading } = useQuery({
    queryKey: ['board-day', stoId, isoDate(selectedDate)],
    queryFn: async () => {
      const from = new Date(selectedDate); from.setHours(0,0,0,0)
      const to   = new Date(selectedDate); to.setHours(23,59,59,999)
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, status, scheduled_date, notes,
          total_cost, total_work_cost, total_parts_cost,
          work_paid, parts_paid,
          work_items, part_items,
          appointment_services(id, description, cost),
          customers(id, name, phone),
          vehicles(id, brand, model, license_plate),
          assigned_to_profile:user_profiles!assigned_to(full_name)
        `)
        .eq('sto_company_id', stoId!)
        .not('status', 'in', '(deleted)')
        .gte('scheduled_date', from.toISOString())
        .lte('scheduled_date', to.toISOString())
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!stoId && view === 'day',
    staleTime: 30_000,
  })

  // ── Week query ────────────────────────────────────────────────────────────
  const weekEnd = addDays(weekStart, 6)
  const { data: weekAppts = [], isLoading: weekLoading } = useQuery({
    queryKey: ['board-week', stoId, isoDate(weekStart)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`id, status, scheduled_date, customers(name), vehicles(brand, model), total_cost, total_work_cost`)
        .eq('sto_company_id', stoId!)
        .not('status', 'in', '(deleted)')
        .gte('scheduled_date', weekStart.toISOString())
        .lte('scheduled_date', new Date(weekEnd.getTime() + 86399999).toISOString())
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!stoId && view === 'week',
    staleTime: 60_000,
  })

  // ── Status mutation ───────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: any = { status }
      if (status === 'archived') payload.closed_date = new Date().toISOString()
      const { error } = await supabase.from('appointments').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-kanban', stoId] })
      queryClient.invalidateQueries({ queryKey: ['board-day',    stoId] })
      queryClient.invalidateQueries({ queryKey: ['board-week',   stoId] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Статус обновлён')
    },
    onError: () => toast.error('Ошибка при обновлении статуса'),
  })

  const handleStatusChange = (id: string, status: string) => statusMutation.mutate({ id, status })

  const openNew = (date?: string) => {
    if (!canCreate.appointment()) { setShowUpgradeModal(true); return }
    setNewModalDate(date)
    setIsNewModalOpen(true)
  }

  // ── Уникальные механики из данных ────────────────────────────────────────
  const mechanics = useMemo(() => {
    const names = new Set<string>()
    ;(kanbanAppts as any[]).forEach(a => {
      if (a.assigned_to_profile?.full_name) names.add(a.assigned_to_profile.full_name)
    })
    return Array.from(names).sort()
  }, [kanbanAppts])

  // ── Фильтр ────────────────────────────────────────────────────────────────
  const applyFilters = (list: any[]) => {
    let r = list
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(a =>
        a.customers?.name?.toLowerCase().includes(q) ||
        a.customers?.phone?.toLowerCase().includes(q) ||
        a.vehicles?.brand?.toLowerCase().includes(q) ||
        a.vehicles?.model?.toLowerCase().includes(q) ||
        a.vehicles?.license_plate?.toLowerCase().includes(q)
      )
    }
    if (mechanicFilter !== 'all') {
      r = r.filter(a => a.assigned_to_profile?.full_name === mechanicFilter)
    }
    return r
  }

  // ── Kanban derived data ───────────────────────────────────────────────────
  const kanbanFiltered = useMemo(() => applyFilters(kanbanAppts as any[]), [kanbanAppts, search, mechanicFilter])

  const kanbanByStatus = useMemo(() => {
    const map: Record<string, any[]> = { scheduled: [], in_progress: [], completed: [], archived: [], cancelled: [] }
    kanbanFiltered.forEach(a => {
      const key = a.status === 'ready' ? 'completed' : a.status
      if (map[key]) map[key].push(a)
    })
    return map
  }, [kanbanFiltered])

  const columnRevenue = useMemo(() => {
    const out: Record<string, number> = {}
    Object.entries(kanbanByStatus).forEach(([key, appts]) => {
      out[key] = appts.reduce((s, a) => s + totalCost(a), 0)
    })
    return out
  }, [kanbanByStatus])

  // ── List derived data ─────────────────────────────────────────────────────
  const listData = useMemo(() => {
    let r = applyFilters(kanbanAppts as any[])
    if (listStatusFilter === 'active') {
      r = r.filter(a => !['archived', 'cancelled'].includes(a.status))
    } else if (listStatusFilter !== 'all') {
      const target = listStatusFilter
      r = r.filter(a => a.status === target || (target === 'completed' && a.status === 'ready'))
    }
    return r.slice().sort((a, b) => {
      const da = parseLocal(a.scheduled_date)?.getTime() ?? 0
      const db = parseLocal(b.scheduled_date)?.getTime() ?? 0
      return db - da
    })
  }, [kanbanAppts, search, mechanicFilter, listStatusFilter])

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todayStr = isoDate(new Date())
    const all = kanbanAppts as any[]
    return {
      todayCount:   all.filter(a => { const d = parseLocal(a.scheduled_date); return d ? isoDate(d) === todayStr : false }).length,
      inProgress:   all.filter(a => a.status === 'in_progress').length,
      totalRevenue: all
        .filter(a => ['in_progress', 'completed', 'ready'].includes(a.status))
        .reduce((s, a) => s + totalCost(a), 0),
    }
  }, [kanbanAppts])

  // ── Day/hour derived data ─────────────────────────────────────────────────
  const dayFiltered = useMemo(() => applyFilters(dayAppts as any[]), [dayAppts, search, mechanicFilter])

  const dayByHour = useMemo(() => {
    const map: Record<number, any[]> = {}
    HOUR_RANGE.forEach(h => (map[h] = []))
    dayFiltered.forEach(a => {
      const d = parseLocal(a.scheduled_date)
      if (!d) return
      const h = d.getHours()
      ;(map[h] ?? (map[h] = [])).push(a)
    })
    return map
  }, [dayFiltered])

  const todayStr = isoDate(new Date())
  const isToday  = isoDate(selectedDate) === todayStr

  // ── Week days ─────────────────────────────────────────────────────────────
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d  = addDays(weekStart, i)
    const ds = isoDate(d)
    const appts = (weekAppts as any[]).filter(a => {
      const ad = parseLocal(a.scheduled_date)
      return ad ? isoDate(ad) === ds : false
    })
    return { date: d, appts, isToday: ds === todayStr }
  }), [weekStart, weekAppts, todayStr])

  const currentHour = new Date().getHours()

  // Видимые колонки kanban (с учётом архива)
  const visibleKanbanCols = KANBAN_COLS.filter(col => showArchived || col.id !== 'archived')

  // Активная мобильная kanban-колонка
  const activeMobileKanbanCol = visibleKanbanCols.find(c => c.id === mobileKanbanCol) ?? visibleKanbanCols[0]

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-5">
          <div className="h-14 flex items-center gap-2 sm:gap-3">

            {/* Заголовок */}
            <h1 className="font-bold text-gray-900 text-base sm:text-lg flex-shrink-0">Записи</h1>

            {/* Переключатель вида */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
              {([
                { id: 'kanban', icon: LayoutGrid,  label: 'Доска'   },
                { id: 'day',    icon: CalendarDays, label: 'День'    },
                { id: 'week',   icon: Calendar,     label: 'Неделя'  },
                { id: 'list',   icon: List,         label: 'Список'  },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all
                    ${view === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Поиск (десктоп) */}
            <div className="relative flex-1 max-w-xs hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Клиент, авто, номер..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Фильтр механика (только владелец) */}
            {isStoOwner && mechanics.length > 0 && (
              <select
                value={mechanicFilter}
                onChange={e => setMechanicFilter(e.target.value)}
                className="hidden sm:block text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 flex-shrink-0 max-w-[140px]"
              >
                <option value="all">Все механики</option>
                {mechanics.map(m => (
                  <option key={m} value={m}>{m.split(' ')[0]}</option>
                ))}
              </select>
            )}

            {/* Архив */}
            {(view === 'kanban' || view === 'list') && (
              <button
                onClick={() => setShowArchived(v => !v)}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex-shrink-0
                  ${showArchived ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Архив</span>
              </button>
            )}

            {/* Быстрая статистика */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs flex-shrink-0">
              <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-semibold tabular-nums" title="Записей сегодня">
                📅 {stats.todayCount}
              </span>
              <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-md font-semibold tabular-nums" title="В работе">
                🔧 {stats.inProgress}
              </span>
              {stats.totalRevenue > 0 && (
                <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md font-semibold tabular-nums" title="Выручка (в работе + готово)">
                  {fmtMoney(stats.totalRevenue)}
                </span>
              )}
            </div>

            <div className="flex-1" />

            {/* Кнопка новой записи */}
            <button
              onClick={() => openNew()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Запись</span>
            </button>
          </div>

          {/* Мобильный поиск */}
          <div className="sm:hidden pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Клиент, авто, номер..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none bg-gray-50"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Мобильные табы фильтра списка */}
          {view === 'list' && (
            <div className="sm:hidden overflow-x-auto flex gap-1.5 pb-1 -mx-3 px-3">
              {([
                { id: 'active',      label: 'Активные' },
                { id: 'scheduled',   label: 'Запланировано' },
                { id: 'in_progress', label: 'В работе' },
                { id: 'completed',   label: 'Готово' },
                { id: 'all',         label: 'Все' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setListStatusFilter(tab.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                    ${listStatusFilter === tab.id
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4">

        {/* ══════════════ KANBAN ══════════════ */}
        {view === 'kanban' && (
          kanbanLoading ? <Spinner /> : (
            <>
              {/* Мобильные табы kanban-колонок */}
              <div className="flex sm:hidden gap-1 mb-3 bg-gray-100 p-0.5 rounded-lg">
                {visibleKanbanCols.map(col => {
                  const count = kanbanByStatus[col.id]?.length || 0
                  return (
                    <button
                      key={col.id}
                      onClick={() => setMobileKanbanCol(col.id)}
                      className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all
                        ${mobileKanbanCol === col.id
                          ? 'bg-white shadow-sm text-gray-900'
                          : 'text-gray-500'}`}
                    >
                      {MOBILE_KANBAN_LABELS[col.id] || col.label.slice(0, 3)}
                      {count > 0 ? ` ${count}` : ''}
                    </button>
                  )
                })}
              </div>

              {/* Мобиль: только активная колонка */}
              <div className="sm:hidden">
                {activeMobileKanbanCol && (
                  <KanbanColumn
                    col={activeMobileKanbanCol}
                    colAppts={kanbanByStatus[activeMobileKanbanCol.id] || []}
                    colRev={columnRevenue[activeMobileKanbanCol.id] || 0}
                    onStatusChange={handleStatusChange}
                    onNew={() => openNew()}
                  />
                )}
              </div>

              {/* Десктоп: все колонки */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                {visibleKanbanCols.map(col => (
                  <KanbanColumn
                    key={col.id}
                    col={col}
                    colAppts={kanbanByStatus[col.id] || []}
                    colRev={columnRevenue[col.id] || 0}
                    onStatusChange={handleStatusChange}
                    onNew={() => openNew()}
                  />
                ))}
              </div>
            </>
          )
        )}

        {/* ══════════════ DAY ══════════════ */}
        {view === 'day' && (
          <div className="max-w-2xl mx-auto">
            {/* Навигация */}
            <div className="flex items-center justify-between mb-4 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <button
                onClick={() => setSelectedDate(d => addDays(d, -1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="text-center">
                <p className="font-bold text-gray-900">
                  {isToday ? 'Сегодня' : `${selectedDate.getDate()} ${MONTHS_GEN[selectedDate.getMonth()]}`}
                  {!isToday && <span className="text-gray-400 text-sm ml-2">{selectedDate.getFullYear()}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {WEEKDAYS[(selectedDate.getDay() + 6) % 7]}
                  {!isToday && (
                    <button
                      onClick={() => setSelectedDate(new Date())}
                      className="ml-2 text-primary font-semibold hover:underline"
                    >
                      Сегодня
                    </button>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(d => addDays(d, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {dayLoading ? <Spinner /> : (
              <div className="space-y-2">
                {/* Сетка: 4 колонки на десктопе, 2 на мобиле */}
                {[0, 4, 8].map(offset => (
                  <div key={offset} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {HOUR_RANGE.slice(offset, offset + 4).map(hour => {
                      const appts = dayByHour[hour] || []
                      const isCurrentHour = isToday && currentHour === hour
                      return (
                        <div
                          key={hour}
                          ref={isCurrentHour ? currentHourRef : undefined}
                          className={`rounded-lg border bg-white overflow-hidden min-h-[110px] flex flex-col scroll-mt-20
                            ${isCurrentHour
                              ? 'border-primary ring-1 ring-primary/20 shadow-sm'
                              : 'border-gray-200'}`}
                        >
                          {/* Заголовок часа */}
                          <div
                            className={`px-2.5 py-1.5 flex items-center justify-between border-b flex-shrink-0
                              ${isCurrentHour
                                ? 'bg-primary border-primary'
                                : 'bg-gray-50 border-gray-100'}`}
                          >
                            <span className={`text-xs font-bold tabular-nums ${isCurrentHour ? 'text-white' : 'text-gray-500'}`}>
                              {String(hour).padStart(2,'0')}:00
                            </span>
                            {appts.length > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md
                                ${isCurrentHour ? 'bg-white/20 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                                {appts.length}
                              </span>
                            )}
                          </div>

                          {/* Содержимое */}
                          <div className="flex-1 p-1.5 space-y-1">
                            {appts.length === 0 ? (
                              <button
                                onClick={() => {
                                  const d = new Date(selectedDate)
                                  d.setHours(hour, 0, 0, 0)
                                  openNew(isoDate(d) + `T${String(hour).padStart(2,'0')}:00`)
                                }}
                                className="w-full h-full min-h-[60px] flex items-center justify-center text-gray-200 hover:text-primary hover:bg-primary/5 rounded-md transition-all group"
                              >
                                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ) : (
                              appts.map(appt => {
                                const cfg = STATUS_CFG[appt.status] ?? STATUS_CFG.scheduled
                                const cost = totalCost(appt)
                                return (
                                  <button
                                    key={appt.id}
                                    onClick={() => navigate(`/sto/appointments/${appt.id}`)}
                                    className="w-full text-left rounded-md px-2 py-1.5 hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: cfg.bg, borderLeft: `3px solid ${cfg.color}` }}
                                  >
                                    <p className="text-[11px] font-bold truncate" style={{ color: cfg.color }}>
                                      {appt.customers?.name?.split(' ')[0] || '—'}
                                    </p>
                                    {appt.vehicles && (
                                      <p className="text-[10px] text-gray-500 truncate leading-tight">
                                        {appt.vehicles.brand} {appt.vehicles.model}
                                      </p>
                                    )}
                                    {cost > 0 && (
                                      <p className="text-[10px] font-semibold text-gray-700 mt-0.5">
                                        ₴{cost.toLocaleString('ru-RU')}
                                      </p>
                                    )}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ WEEK ══════════════ */}
        {view === 'week' && (
          <div>
            {/* Навигация */}
            <div className="flex items-center justify-between mb-4 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <button
                onClick={() => setWeekStart(d => addDays(d, -7))}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-sm sm:text-base">
                  {weekStart.getDate()} {MONTHS_GEN[weekStart.getMonth()]} — {weekEnd.getDate()} {MONTHS_GEN[weekEnd.getMonth()]}
                </p>
                {!weekDays.some(d => d.isToday) && (
                  <button
                    onClick={() => setWeekStart(getWeekStart(new Date()))}
                    className="text-xs text-primary font-semibold hover:underline mt-0.5"
                  >
                    Текущая неделя
                  </button>
                )}
              </div>
              <button
                onClick={() => setWeekStart(d => addDays(d, 7))}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {weekLoading ? <Spinner /> : (
              <>
                {/* Десктоп: все 7 дней */}
                <div className="hidden sm:grid sm:grid-cols-7 gap-2">
                  {weekDays.map(({ date, appts, isToday: isDayToday }, idx) => (
                    <WeekDayCell
                      key={idx}
                      date={date}
                      appts={appts}
                      isDayToday={isDayToday}
                      idx={idx}
                      onDayClick={() => { setSelectedDate(date); setView('day') }}
                      onNewAppt={() => { setSelectedDate(date); openNew(isoDate(date) + 'T09:00') }}
                      navigate={navigate}
                    />
                  ))}
                </div>

                {/* Мобиль: переключатель Пн–Ср / Чт–Вс + 4 дня */}
                <div className="sm:hidden">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setWeekMobileOffset(0)}
                      className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
                        ${weekMobileOffset === 0 ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}
                    >
                      Пн–Ср
                    </button>
                    <button
                      onClick={() => setWeekMobileOffset(3)}
                      className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all
                        ${weekMobileOffset === 3 ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 bg-white'}`}
                    >
                      Чт–Вс
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {weekDays.slice(weekMobileOffset, weekMobileOffset + 4).map(({ date, appts, isToday: isDayToday }, i) => {
                      const idx = weekMobileOffset + i
                      return (
                        <WeekDayCell
                          key={idx}
                          date={date}
                          appts={appts}
                          isDayToday={isDayToday}
                          idx={idx}
                          onDayClick={() => { setSelectedDate(date); setView('day') }}
                          onNewAppt={() => { setSelectedDate(date); openNew(isoDate(date) + 'T09:00') }}
                          navigate={navigate}
                        />
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════ LIST ══════════════ */}
        {view === 'list' && (
          <div>
            {/* Табы статусов (десктоп) */}
            <div className="hidden sm:flex items-center gap-1.5 mb-4 flex-wrap">
              {([
                { id: 'active',      label: 'Активные' },
                { id: 'scheduled',   label: 'Запланировано' },
                { id: 'in_progress', label: 'В работе' },
                { id: 'completed',   label: 'Готово' },
                { id: 'all',         label: 'Все' },
              ] as const).map(tab => {
                const count = tab.id === 'active'
                  ? (kanbanAppts as any[]).filter(a => !['archived','cancelled'].includes(a.status)).length
                  : tab.id === 'all'
                    ? (kanbanAppts as any[]).length
                    : tab.id === 'completed'
                      ? (kanbanAppts as any[]).filter(a => ['completed','ready'].includes(a.status)).length
                      : (kanbanAppts as any[]).filter(a => a.status === tab.id).length
                return (
                  <button
                    key={tab.id}
                    onClick={() => setListStatusFilter(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${listStatusFilter === tab.id
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    {tab.label}
                    <span className={`tabular-nums ${listStatusFilter === tab.id ? 'opacity-80' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {kanbanLoading ? <Spinner /> : listData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <p className="text-sm font-medium mb-3">Нет записей</p>
                <button
                  onClick={() => openNew()}
                  className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Создать запись
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {listData.map(appt => (
                  <ListRow key={appt.id} appt={appt} onStatusChange={handleStatusChange} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => { setIsNewModalOpen(false); setNewModalDate(undefined) }}
        prefilledDate={newModalDate?.slice(0, 10)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['board-kanban', stoId] })
          queryClient.invalidateQueries({ queryKey: ['board-day',    stoId] })
          queryClient.invalidateQueries({ queryKey: ['board-week',   stoId] })
        }}
      />

      <SubscriptionUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        context="appointments"
        currentPlan={hasSubscription ? plan?.name : 'Пробный'}
        used={usage.appointments}
        limit={limits.maxAppointments ?? 10}
      />
    </div>
  )
}

// ─── WeekDayCell ─────────────────────────────────────────────────────────────

function WeekDayCell({
  date, appts, isDayToday, idx, onDayClick, onNewAppt, navigate,
}: {
  date: Date
  appts: any[]
  isDayToday: boolean
  idx: number
  onDayClick: () => void
  onNewAppt: () => void
  navigate: (path: string) => void
}) {
  const isWeekend = idx >= 5
  return (
    <div
      className={`rounded-xl overflow-hidden border bg-white shadow-sm
        ${isDayToday ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100'}`}
    >
      <button
        onClick={onDayClick}
        className={`w-full px-2 py-2.5 text-center border-b border-gray-100 hover:bg-gray-50 transition-colors rounded-t-xl
          ${isDayToday ? 'bg-primary/5' : ''}`}
      >
        <p className={`text-[11px] font-semibold ${isWeekend ? 'text-red-400' : 'text-gray-500'}`}>
          {WEEKDAYS[idx]}
        </p>
        <p className={`text-lg font-bold leading-tight
          ${isDayToday ? 'text-primary' : isWeekend ? 'text-red-400' : 'text-gray-900'}`}>
          {date.getDate()}
        </p>
        {appts.length > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md
            ${isDayToday ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
            {appts.length}
          </span>
        )}
      </button>
      <div className="p-1.5 space-y-1 min-h-[80px]">
        {appts.length === 0 ? (
          <button
            onClick={onNewAppt}
            className="w-full h-8 flex items-center justify-center text-gray-200 hover:text-primary hover:bg-primary/5 rounded-lg transition-all group"
          >
            <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <>
            {appts.slice(0, 4).map(appt => {
              const cfg = STATUS_CFG[appt.status] ?? STATUS_CFG.scheduled
              const d   = parseLocal(appt.scheduled_date)
              return (
                <button
                  key={appt.id}
                  onClick={() => navigate(`/sto/appointments/${appt.id}`)}
                  className="w-full text-left px-1.5 py-1 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: cfg.bg, borderLeft: `3px solid ${cfg.color}` }}
                >
                  <p className="text-[10px] font-bold tabular-nums" style={{ color: cfg.color }}>
                    {d ? fmtTime(d) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-700 truncate leading-tight">
                    {appt.customers?.name?.split(' ')[0] || '—'}
                  </p>
                </button>
              )
            })}
            {appts.length > 4 && (
              <button
                onClick={onDayClick}
                className="w-full text-[10px] text-primary font-semibold text-center py-0.5 hover:underline"
              >
                +{appts.length - 4} ещё
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
