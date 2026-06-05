import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Archive, Search, X, User, Car, Wrench, Package,
  Clock, ChevronRight, Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Spinner } from '@/components/ui/Spinner'
import { fmtMoney } from '@/utils/money'

// ─── helpers ────────────────────────────────────────────────────────────────
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const DAYS   = ['вс','пн','вт','ср','чт','пт','сб']

function totalCost(a: any) { return a.total_cost || (a.total_work_cost || 0) + (a.total_parts_cost || 0) }
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
function fmtDay(d: Date) { return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}` }
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`
  if ([2,3,4].includes(m10) && ![12,13,14].includes(m100)) return `${n} ${few}`
  return `${n} ${many}`
}

// ─── main ──────────────────────────────────────────────────────────────────
export default function AppointmentsArchive() {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ['appointments-archive', profile?.sto_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`id, status, scheduled_date, closed_date, notes,
          work_items, part_items, total_cost, total_work_cost, total_parts_cost, work_paid, parts_paid,
          customers(name, phone),
          vehicles(brand, model, license_plate),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)`)
        .eq('sto_company_id', profile!.sto_company_id!)
        .eq('status', 'archived')
        .order('closed_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile?.sto_company_id,
    staleTime: 60_000,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return appts as any[]
    const digits = q.replace(/\D/g, '')
    return (appts as any[]).filter(a =>
      a.customers?.name?.toLowerCase().includes(q) ||
      `${a.vehicles?.brand ?? ''} ${a.vehicles?.model ?? ''}`.toLowerCase().includes(q) ||
      a.vehicles?.license_plate?.toLowerCase().includes(q) ||
      (digits.length >= 3 && a.customers?.phone?.replace(/\D/g, '').includes(digits))
    )
  }, [appts, search])

  // Группировка по месяцу закрытия
  const groups = useMemo(() => {
    const map: Record<string, { y: number; m: number; items: any[]; total: number }> = {}
    filtered.forEach(a => {
      const d = parseDate(a.closed_date) || parseDate(a.scheduled_date) || new Date()
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map[key]) map[key] = { y: d.getFullYear(), m: d.getMonth(), items: [], total: 0 }
      map[key].items.push(a)
      map[key].total += totalCost(a)
    })
    return Object.values(map).sort((a, b) => b.y - a.y || b.m - a.m)
  }, [filtered])

  const grandTotal = useMemo(() => filtered.reduce((s, a) => s + totalCost(a), 0), [filtered])

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-3 sm:px-5">
          <div className="h-14 flex items-center gap-3">
            <button onClick={() => navigate('/appointments')}
              className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Archive className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-base sm:text-lg leading-tight">Архив заявок</h1>
              <p className="text-xs text-gray-400 leading-none mt-0.5">
                {isLoading ? 'Загрузка…' : `${plural(filtered.length, 'заявка', 'заявки', 'заявок')} · ${fmtMoney(grandTotal)}`}
              </p>
            </div>
            {/* Поиск (десктоп) */}
            <div className="relative hidden sm:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Клиент, авто, номер…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Поиск (мобиль) */}
          <div className="sm:hidden pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Клиент, авто, номер…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none bg-gray-50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="w-full px-3 sm:px-5 py-4">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Archive className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-medium text-gray-500 mb-1">{search ? 'Ничего не найдено' : 'Архив пуст'}</p>
            <p className="text-sm text-gray-400">
              {search ? 'Измените поисковый запрос' : 'Закрытые заявки появятся здесь'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(g => (
              <div key={`${g.y}-${g.m}`}>
                {/* Заголовок месяца */}
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <h2 className="text-sm font-bold text-gray-900 capitalize">
                      {MONTHS[g.m]} {g.y}
                    </h2>
                    <span className="text-xs font-semibold text-gray-400">
                      {plural(g.items.length, 'заявка', 'заявки', 'заявок')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-700 tabular-nums">{fmtMoney(g.total)}</span>
                </div>

                {/* Карточки */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {g.items.map(a => <ArchiveCard key={a.id} appt={a} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Archive card ──────────────────────────────────────────────────────────
function ArchiveCard({ appt }: { appt: any }) {
  const closed = parseDate(appt.closed_date)
  const works: any[] = appt.work_items || []
  const parts: any[] = appt.part_items || []
  const worker = appt.assigned_to_profile?.full_name || appt.assigned_to_profile?.email?.split('@')[0]
  const cost = totalCost(appt)
  const hasWork = (appt.total_work_cost || 0) > 0
  const hasParts = (appt.total_parts_cost || 0) > 0

  return (
    <Link
      to={`/sto/appointments/${appt.id}`}
      state={{ from: '/appointments/archive' }}
      className="group bg-white rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all overflow-hidden flex flex-col"
    >
      {/* Шапка карточки */}
      <div className="p-4 pb-3 border-b border-gray-50">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-primary transition-colors">
              {appt.customers?.name || 'Клиент не указан'}
            </p>
          </div>
          {closed && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" />{fmtDay(closed)}
            </span>
          )}
        </div>
        {appt.vehicles && (
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600 truncate">
              {appt.vehicles.brand} {appt.vehicles.model}
            </span>
            {appt.vehicles.license_plate && (
              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">
                {appt.vehicles.license_plate}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Работы и запчасти */}
      <div className="p-4 pt-3 flex-1 space-y-2.5">
        {works.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Wrench className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Работы</span>
            </div>
            <ul className="space-y-0.5">
              {works.slice(0, 4).map((w: any, i: number) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-gray-700 truncate">{w.name}</span>
                  <span className="text-gray-500 tabular-nums flex-shrink-0">{fmtMoney(w.price)}</span>
                </li>
              ))}
              {works.length > 4 && <li className="text-[11px] text-gray-400">+ ещё {works.length - 4}</li>}
            </ul>
          </div>
        )}

        {parts.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Запчасти</span>
            </div>
            <ul className="space-y-0.5">
              {parts.slice(0, 3).map((p: any, i: number) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-gray-700 truncate">{p.name}</span>
                  <span className="text-gray-500 tabular-nums flex-shrink-0">{fmtMoney(p.totalPrice)}</span>
                </li>
              ))}
              {parts.length > 3 && <li className="text-[11px] text-gray-400">+ ещё {parts.length - 3}</li>}
            </ul>
          </div>
        )}

        {works.length === 0 && parts.length === 0 && (
          <p className="text-xs text-gray-400 italic">Работы и запчасти не указаны</p>
        )}
      </div>

      {/* Подвал: итог + мастер + оплата */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {worker && <span className="text-xs text-violet-600 font-medium truncate">{worker}</span>}
          </div>
          <span className="text-base font-bold text-gray-900 tabular-nums flex-shrink-0">{fmtMoney(cost)}</span>
        </div>
        {(hasWork || hasParts) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {hasWork && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${appt.work_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                Работы {appt.work_paid ? '✓' : '—'}
              </span>
            )}
            {hasParts && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${appt.parts_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                Запчасти {appt.parts_paid ? '✓' : '—'}
              </span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto group-hover:text-primary transition-colors" />
          </div>
        )}
      </div>
    </Link>
  )
}
