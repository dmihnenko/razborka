import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import {
  Plus, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, CalendarDays,
  Calendar, User, Car, Clock, Wrench, ArrowRight,
  Archive, Search, X, List, Phone, MoveRight,
} from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import SubscriptionUpgradeModal from '@/components/SubscriptionUpgradeModal'
import { toast } from 'sonner'
import { STATUS_CFG } from '@/constants/appointmentStatus'
import { fmtMoney } from '@/utils/money'

// ─── constants ────────────────────────────────────────────────────────────────

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

const WEEKDAYS      = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS_FULL = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
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
function totalCost(a: any) {
  return a.total_cost || (a.total_work_cost || 0) + (a.total_parts_cost || 0)
}

// ─── Status transition meta ───────────────────────────────────────────────────

const TRANSITION_META: Record<string, { title: string; description: string; confirmLabel: string; icon: string }> = {
  'scheduled→in_progress': {
    title:        'Начать работу?',
    description:  'Заявка перейдёт в статус «В работе». Клиент будет ожидать уведомления о завершении.',
    confirmLabel: 'Начать работу',
    icon:         '🔧',
  },
  'in_progress→completed': {
    title:        'Завершить работу?',
    description:  'Работы по заявке завершены. Автомобиль готов к выдаче клиенту.',
    confirmLabel: 'Отметить готовым',
    icon:         '✅',
  },
  'completed→archived': {
    title:        'Закрыть заявку?',
    description:  'Заявка будет добавлена в архив и включена в статистику месяца. Вернуть из архива можно позже.',
    confirmLabel: 'Закрыть и в архив',
    icon:         '📁',
  },
  'ready→archived': {
    title:        'Закрыть заявку?',
    description:  'Заявка будет добавлена в архив и включена в статистику месяца.',
    confirmLabel: 'Закрыть и в архив',
    icon:         '📁',
  },
}

function getTransitionMeta(from: string, to: string) {
  return TRANSITION_META[`${from}→${to}`] ?? {
    title:        'Изменить статус?',
    description:  `Статус заявки будет изменён с «${STATUS_CFG[from]?.label ?? from}» на «${STATUS_CFG[to]?.label ?? to}».`,
    confirmLabel: STATUS_CFG[to]?.label ?? 'Подтвердить',
    icon:         '🔄',
  }
}

// ─── StatusConfirmModal ───────────────────────────────────────────────────────

interface StatusConfirmState {
  id: string
  fromStatus: string
  toStatus: string
  clientName: string
  vehicleName: string
}

function StatusConfirmModal({
  state, onCancel, onConfirm, isPending,
}: {
  state: StatusConfirmState | null
  onCancel: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  if (!state) return null

  const meta    = getTransitionMeta(state.fromStatus, state.toStatus)
  const fromCfg = STATUS_CFG[state.fromStatus] ?? STATUS_CFG.scheduled
  const toCfg   = STATUS_CFG[state.toStatus]   ?? STATUS_CFG.scheduled

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden">

        {/* Ручка (мобиль) */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Заголовок */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{meta.icon}</span>
            <h2 className="text-base font-bold text-gray-900">{meta.title}</h2>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Клиент / авто */}
          <div className="bg-gray-50 rounded-lg px-3.5 py-2.5">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{state.clientName}</p>
            {state.vehicleName && (
              <p className="text-xs text-gray-500 mt-0.5">{state.vehicleName}</p>
            )}
          </div>

          {/* Переход статуса */}
          <div className="flex items-center gap-2">
            <span
              className="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg border"
              style={{ color: fromCfg.color, backgroundColor: fromCfg.bg, borderColor: fromCfg.border }}
            >
              {fromCfg.label}
            </span>
            <MoveRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span
              className="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg border"
              style={{ color: toCfg.color, backgroundColor: toCfg.bg, borderColor: toCfg.border }}
            >
              {toCfg.label}
            </span>
          </div>

          {/* Описание */}
          <p className="text-sm text-gray-600 leading-relaxed">{meta.description}</p>
        </div>

        {/* Кнопки */}
        <div className="px-5 pb-5 flex gap-2" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: toCfg.color }}
          >
            {isPending ? 'Сохраняем…' : meta.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
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
  onStatusChange: (id: string, status: string, appt: any) => void
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
              onClick={e => { e.stopPropagation(); onStatusChange(appt.id, cfg.next!, appt) }}
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

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({
  col, colAppts, colRev, onStatusChange, onNew,
}: {
  col: typeof KANBAN_COLS[number]
  colAppts: any[]
  colRev: number
  onStatusChange: (id: string, status: string, appt: any) => void
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
    // ?tab= подразумевает список с фильтром
    if (searchParams.get('tab')) return 'list'
    return (v === 'day' || v === 'week' || v === 'list' || v === 'kanban') ? v : 'list'
  })
  const [selectedDate, setSelectedDate]         = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [weekStart, setWeekStart]               = useState(() => getWeekStart(new Date()))
  const [search, setSearch]                     = useState('')
  const showArchived = false  // архив вынесен на отдельную страницу /appointments/archive
  const [mechanicFilter, setMechanicFilter]     = useState('all')
  const [listStatusFilter, setListStatusFilter] = useState<string>(() => {
    const t = searchParams.get('tab')
    return (t === 'scheduled' || t === 'in_progress' || t === 'completed' || t === 'all') ? t : 'active'
  })
  const [isNewModalOpen, setIsNewModalOpen]     = useState(false)
  const [newModalDate, setNewModalDate]         = useState<string | undefined>()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  // Секции списка — все открыты по умолчанию
  const [listOpenSections, setListOpenSections] = useState<Set<string>>(
    () => new Set(['scheduled', 'in_progress', 'completed', 'archived'])
  )
  const toggleListSection = (id: string) =>
    setListOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const [mobileKanbanCol, setMobileKanbanCol]   = useState<string>(() => {
    const t = searchParams.get('tab')
    return (t === 'scheduled' || t === 'in_progress' || t === 'completed') ? t : 'in_progress'
  })
  const [confirmModal, setConfirmModal]         = useState<StatusConfirmState | null>(null)

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
      if (status === 'archived') {
        // Архивировать можно только при полной оплате работ и запчастей
        const { data: cur } = await supabase.from('appointments')
          .select('parts_paid, work_paid, parts_cost, total_parts_cost, total_work_cost')
          .eq('id', id).single()
        const pCost = (cur?.parts_cost ?? cur?.total_parts_cost) || 0
        const wCost = cur?.total_work_cost || 0
        if ((pCost > 0 && !cur?.parts_paid) || (wCost > 0 && !cur?.work_paid)) {
          throw new Error('В архив можно перенести только после полной оплаты работ и запчастей')
        }
        payload.closed_date = new Date().toISOString()
      }
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
    onError: (e: any) => toast.error(e?.message || 'Ошибка при обновлении статуса'),
  })

  const handleStatusChange = (id: string, toStatus: string, appt: any) => {
    // В архив — только при полной оплате работ и запчастей
    if (toStatus === 'archived') {
      const pCost = (appt.parts_cost ?? appt.total_parts_cost) || 0
      const wCost = appt.total_work_cost || 0
      if ((pCost > 0 && !appt.parts_paid) || (wCost > 0 && !appt.work_paid)) {
        toast.error('В архив можно перенести только после полной оплаты работ и запчастей')
        return
      }
    }
    setConfirmModal({
      id,
      fromStatus:  appt.status,
      toStatus,
      clientName:  appt.customers?.name || 'Клиент',
      vehicleName: appt.vehicles
        ? `${appt.vehicles.brand} ${appt.vehicles.model}`.trim()
        : '',
    })
  }

  const confirmStatusChange = () => {
    if (!confirmModal) return
    statusMutation.mutate({ id: confirmModal.id, status: confirmModal.toStatus })
    setConfirmModal(null)
  }

  const openNew = (date?: string) => {
    if (!canCreate.appointment()) { setShowUpgradeModal(true); return }
    if (date) {
      // Дата из клика на день/ячейку — открываем страницу с prefilled датой
      navigate(`/appointments/new?date=${date.slice(0, 10)}`)
    } else {
      navigate('/appointments/new')
    }
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
        <div className="w-full px-3 sm:px-5">
          <div className="h-14 flex items-center gap-2 sm:gap-3">

            {/* Заголовок */}
            <h1 className="font-bold text-gray-900 text-base sm:text-lg flex-shrink-0">Записи</h1>

            {/* Переключатель вида */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
              {([
                { id: 'list',   icon: List,         label: 'Список'  },
                { id: 'day',    icon: CalendarDays, label: 'День'    },
                { id: 'week',   icon: Calendar,     label: 'Неделя'  },
                { id: 'kanban', icon: LayoutGrid,  label: 'Доска'   },
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

            {/* Архив — отдельная страница-история */}
            <button
              onClick={() => navigate('/appointments/archive')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-all flex-shrink-0"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Архив</span>
            </button>

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
            <div className="sm:hidden flex flex-wrap gap-1.5 pb-1">
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

      <div className="w-full px-3 sm:px-5 py-4">

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
          <div className="w-full">
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
              <div className="space-y-2">
                {weekDays.map(({ date, appts, isToday: isDayToday }, idx) => (
                  <WeekDayRow
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
            )}
          </div>
        )}

        {/* ══════════════ LIST — секции по статусу ══════════════ */}
        {view === 'list' && (
          kanbanLoading ? <Spinner /> : (
            <div className="space-y-3">
              {KANBAN_COLS.filter(col => showArchived || col.id !== 'archived').map(col => {
                const appts   = kanbanByStatus[col.id] || []
                const revenue = columnRevenue[col.id] || 0
                const isOpen  = listOpenSections.has(col.id)

                return (
                  <div key={col.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">

                    {/* Заголовок секции */}
                    <button
                      onClick={() => toggleListSection(col.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <span className="font-bold text-gray-900">{col.label}</span>
                        <span
                          className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                          style={{ color: col.color, backgroundColor: col.bg }}
                        >
                          {appts.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {revenue > 0 && (
                          <span className="text-sm font-bold tabular-nums" style={{ color: col.color }}>
                            {fmtMoney(revenue)}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </button>

                    {/* Карточки секции */}
                    {isOpen && (
                      <div className="border-t border-gray-100 p-3 sm:p-4">
                        {appts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                            <p className="text-sm font-medium">Нет записей</p>
                            {col.id === 'scheduled' && (
                              <button
                                onClick={() => openNew()}
                                className="mt-2 text-sm text-primary font-semibold hover:underline flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" /> Добавить запись
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {appts.map(appt => (
                              <AppointmentCard
                                key={appt.id}
                                appt={appt}
                                onStatusChange={handleStatusChange}
                                showDate
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Пусто совсем */}
              {KANBAN_COLS.filter(col => showArchived || col.id !== 'archived')
                .every(col => (kanbanByStatus[col.id] || []).length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <p className="text-sm font-medium mb-3">Нет записей</p>
                  <button
                    onClick={() => openNew()}
                    className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Создать запись
                  </button>
                </div>
              )}
            </div>
          )
        )}

      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <StatusConfirmModal
        state={confirmModal}
        onCancel={() => setConfirmModal(null)}
        onConfirm={confirmStatusChange}
        isPending={statusMutation.isPending}
      />

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

// ─── Week agenda (day rows) ─────────────────────────────────────────────────

function WeekApptCard({ appt, navigate }: { appt: any; navigate: (path: string) => void }) {
  const cfg  = STATUS_CFG[appt.status] ?? STATUS_CFG.scheduled
  const d    = parseLocal(appt.scheduled_date)
  const cost = totalCost(appt)
  return (
    <button
      onClick={() => navigate(`/sto/appointments/${appt.id}`)}
      className="w-full sm:w-52 text-left rounded-lg px-2.5 py-2 hover:shadow-sm transition-all"
      style={{ backgroundColor: cfg.bg, borderLeft: `3px solid ${cfg.color}` }}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="text-xs font-bold tabular-nums" style={{ color: cfg.color }}>
          {d ? fmtTime(d) : '—'}
        </span>
        {cost > 0 && (
          <span className="text-[10px] font-semibold text-gray-500 tabular-nums">{fmtMoney(cost)}</span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-900 truncate">
        {appt.customers?.name || 'Клиент не указан'}
      </p>
      {appt.vehicles && (
        <p className="text-[11px] text-gray-500 truncate leading-tight">
          {appt.vehicles.brand} {appt.vehicles.model}
        </p>
      )}
    </button>
  )
}

function WeekDayRow({
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
      className={`flex flex-col sm:flex-row rounded-xl overflow-hidden border bg-white shadow-sm
        ${isDayToday ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100'}`}
    >
      {/* Колонка даты */}
      <button
        onClick={onDayClick}
        className={`flex sm:flex-col items-center justify-center sm:justify-center gap-2 sm:gap-0.5
          px-4 py-2.5 sm:py-4 sm:w-32 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-100
          hover:bg-gray-50 transition-colors ${isDayToday ? 'bg-primary/5' : ''}`}
      >
        <span className={`text-xs font-semibold uppercase tracking-wide ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
          {WEEKDAYS_FULL[idx]}
        </span>
        <div className="flex items-baseline gap-1.5 sm:flex-col sm:items-center sm:gap-0">
          <span className={`text-2xl font-bold leading-none
            ${isDayToday ? 'text-primary' : isWeekend ? 'text-red-400' : 'text-gray-900'}`}>
            {date.getDate()}
          </span>
          <span className="text-[11px] text-gray-400">{MONTHS_GEN[date.getMonth()]}</span>
        </div>
        {appts.length > 0 && (
          <span className={`sm:mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md
            ${isDayToday ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
            {appts.length}
          </span>
        )}
      </button>

      {/* Записи дня */}
      <div className="flex-1 p-2 sm:p-3 min-w-0">
        {appts.length === 0 ? (
          <button
            onClick={onNewAppt}
            className="w-full h-full min-h-[44px] flex items-center justify-center gap-1.5
              text-xs font-medium text-gray-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить запись
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {appts.map(appt => (
              <WeekApptCard key={appt.id} appt={appt} navigate={navigate} />
            ))}
            <button
              onClick={onNewAppt}
              className="w-9 self-stretch min-h-[44px] flex items-center justify-center text-gray-300
                hover:text-primary hover:bg-primary/5 rounded-lg border border-dashed border-gray-200
                hover:border-primary/40 transition-all"
              title="Добавить запись"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
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
