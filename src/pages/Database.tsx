import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Users,
  Car,
  Calendar,
  Package,
  ShoppingCart,
  Building2,
  Trash2,
  RefreshCw,
  Shield,
  CreditCard,
  Wrench,
  Receipt,
  Tag,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── helpers ─────────────────────────────────────────────────────────────────

function pct(used: number, limit: number | null) {
  if (!limit) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function ProgressBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-xs text-green-600 font-medium">∞ Без лимита</span>
  const p = pct(used, limit)
  const color = p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600 whitespace-nowrap">
        {used} / {limit}
      </span>
    </div>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface TableStatCardProps {
  label: string
  count: number | undefined
  icon: React.ElementType
  color: string
}
function TableStatCard({ label, count, icon: Icon, color }: TableStatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">
          {count === undefined ? '...' : count.toLocaleString('ru-RU')}
        </p>
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DatabasePage() {
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [expandedSto, setExpandedSto] = useState<string | null>(null)
  const [expandedParts, setExpandedParts] = useState<string | null>(null)

  // ── 1. Table row counts ──────────────────────────────────────────────────
  const { data: counts } = useQuery({
    queryKey: ['db-counts'],
    queryFn: async () => {
      const tables = [
        'user_profiles',
        'roles',
        'sto_companies',
        'customers',
        'vehicles',
        'appointments',
        'work_orders',
        'services',
        'sto_invoices',
        'parts_companies',
        'parts_vehicles',
        'parts_inventory',
        'parts_orders',
        'parts_customers',
        'parts_categories',
        'subscriptions',
        'company_subscriptions',
        'trash_bin',
      ] as const

      const results = await Promise.all(
        tables.map((t) =>
          supabase.from(t).select('*', { count: 'exact', head: true }).then(({ count }) => [t, count ?? 0] as const)
        )
      )
      return Object.fromEntries(results) as Record<(typeof tables)[number], number>
    },
    staleTime: 30_000,
  })

  // ── 2. STO companies + subscription + usage ──────────────────────────────
  const { data: stoCompanies = [], isLoading: stoLoading } = useQuery({
    queryKey: ['db-sto-limits'],
    queryFn: async () => {
      const { data: companies, error } = await supabase
        .from('sto_companies')
        .select('id, name, is_active')
        .order('name')
      if (error) throw error

      const results = await Promise.all(
        (companies ?? []).map(async (c) => {
          const [workers, appointments, customers, vehicles, sub] = await Promise.all([
            supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('sto_company_id', c.id),
            supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('sto_company_id', c.id),
            supabase.from('customers').select('*', { count: 'exact', head: true }).eq('sto_company_id', c.id),
            supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('sto_company_id', c.id),
            supabase
              .from('company_subscriptions')
              .select('*, subscription:subscriptions(name)')
              .eq('company_type', 'sto')
              .eq('company_id', c.id)
              .eq('is_active', true)
              .maybeSingle(),
          ])
          const hasSub = !!sub.data && (!sub.data.end_date || new Date(sub.data.end_date) > new Date())
          return {
            ...c,
            workers: workers.count ?? 0,
            appointments: appointments.count ?? 0,
            customers: customers.count ?? 0,
            vehicles: vehicles.count ?? 0,
            hasSub,
            subName: (sub.data?.subscription as any)?.name ?? null,
          }
        })
      )
      return results
    },
    staleTime: 30_000,
  })

  // ── 3. Parts companies + subscription + usage ────────────────────────────
  const { data: partsCompanies = [], isLoading: partsLoading } = useQuery({
    queryKey: ['db-parts-limits'],
    queryFn: async () => {
      const { data: companies, error } = await supabase
        .from('parts_companies')
        .select('id, name, is_active')
        .order('name')
      if (error) throw error

      const results = await Promise.all(
        (companies ?? []).map(async (c) => {
          const [workers, vehicles, parts, sub] = await Promise.all([
            supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('parts_company_id', c.id),
            supabase.from('parts_vehicles').select('*', { count: 'exact', head: true }).eq('parts_company_id', c.id),
            supabase.from('parts_inventory').select('*', { count: 'exact', head: true }).eq('parts_company_id', c.id),
            supabase
              .from('company_subscriptions')
              .select('*, subscription:subscriptions(name)')
              .eq('company_type', 'parts')
              .eq('company_id', c.id)
              .eq('is_active', true)
              .maybeSingle(),
          ])
          const hasSub = !!sub.data && (!sub.data.end_date || new Date(sub.data.end_date) > new Date())
          return {
            ...c,
            workers: workers.count ?? 0,
            vehicles: vehicles.count ?? 0,
            parts: parts.count ?? 0,
            hasSub,
            subName: (sub.data?.subscription as any)?.name ?? null,
          }
        })
      )
      return results
    },
    staleTime: 30_000,
  })

  // ── 4. Clear expired trash ───────────────────────────────────────────────
  const clearTrashMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('trash_bin')
        .delete()
        .lt('expires_at', new Date().toISOString())
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-counts'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success('Истёкшие записи корзины удалены')
    },
    onError: () => toast.error('Ошибка при очистке корзины'),
  })

  const handleClearTrash = async () => {
    const ok = await showConfirm({
      message: 'Удалить все истёкшие записи из корзины? Это действие нельзя отменить.',
      danger: true,
    })
    if (ok) clearTrashMutation.mutate()
  }

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['db-counts'] })
    queryClient.invalidateQueries({ queryKey: ['db-sto-limits'] })
    queryClient.invalidateQueries({ queryKey: ['db-parts-limits'] })
    toast.success('Данные обновлены')
  }

  // FREE limits (mirrors useSubscription.ts)
  const FREE_STO = { workers: 1, appointments: 5, customers: 3, vehicles: 3 }
  const FREE_PARTS = { workers: 1, vehicles: 1, parts: 10 }

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />

      {/* Header */}
      <div className="flex justify-end">
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* ── Section 1: STO tables ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" />
          Таблицы СТО
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <TableStatCard label="Пользователи" count={counts?.user_profiles} icon={Users} color="bg-blue-100 text-blue-600" />
          <TableStatCard label="Роли" count={counts?.roles} icon={Shield} color="bg-purple-100 text-purple-600" />
          <TableStatCard label="Компании СТО" count={counts?.sto_companies} icon={Building2} color="bg-indigo-100 text-indigo-600" />
          <TableStatCard label="Клиенты" count={counts?.customers} icon={Users} color="bg-cyan-100 text-cyan-600" />
          <TableStatCard label="Автомобили" count={counts?.vehicles} icon={Car} color="bg-violet-100 text-violet-600" />
          <TableStatCard label="Записи" count={counts?.appointments} icon={Calendar} color="bg-green-100 text-green-600" />
          <TableStatCard label="Заказ-наряды" count={counts?.work_orders} icon={Wrench} color="bg-teal-100 text-teal-600" />
          <TableStatCard label="Услуги" count={counts?.services} icon={Wrench} color="bg-emerald-100 text-emerald-600" />
          <TableStatCard label="Счета" count={counts?.invoices} icon={Receipt} color="bg-lime-100 text-lime-600" />
        </div>
      </div>

      {/* ── Section 2: Parts tables ───────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-orange-500" />
          Таблицы авторазборки
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <TableStatCard label="Компании разборки" count={counts?.parts_companies} icon={Building2} color="bg-orange-100 text-orange-600" />
          <TableStatCard label="Авто на разборку" count={counts?.parts_vehicles} icon={Car} color="bg-amber-100 text-amber-600" />
          <TableStatCard label="Запчасти" count={counts?.parts_inventory} icon={Package} color="bg-red-100 text-red-600" />
          <TableStatCard label="Заказы" count={counts?.parts_orders} icon={ShoppingCart} color="bg-pink-100 text-pink-600" />
          <TableStatCard label="Клиенты разборки" count={counts?.parts_customers} icon={Users} color="bg-rose-100 text-rose-600" />
          <TableStatCard label="Категории" count={counts?.parts_categories} icon={Tag} color="bg-fuchsia-100 text-fuchsia-600" />
        </div>
      </div>

      {/* ── Section 3: Subscriptions + Trash ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TableStatCard label="Планы подписок" count={counts?.subscriptions} icon={CreditCard} color="bg-sky-100 text-sky-600" />
        <TableStatCard label="Активные подписки" count={counts?.company_subscriptions} icon={CheckCircle} color="bg-green-100 text-green-600" />
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Корзина</p>
              <p className="text-xl font-bold text-gray-900">
                {counts?.trash_bin === undefined ? '...' : counts.trash_bin.toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearTrash}
            disabled={clearTrashMutation.isPending || !counts?.trash_bin}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Очистить
          </button>
        </div>
      </div>

      {/* ── Section 4: STO company limits ────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          Лимиты компаний СТО
        </h2>
        {stoLoading ? (
          <div className="text-sm text-gray-400 p-4">Загрузка...</div>
        ) : stoCompanies.length === 0 ? (
          <div className="text-sm text-gray-400 p-4 bg-white border rounded-lg">Нет компаний СТО</div>
        ) : (
          <div className="space-y-2">
            {stoCompanies.map((c) => {
              const isOpen = expandedSto === c.id
              const limits = c.hasSub ? null : FREE_STO
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedSto(isOpen ? null : c.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-medium text-sm text-gray-900">{c.name}</span>
                      {!c.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Неактивна</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {c.hasSub ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          {c.subName ?? 'Подписка'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" />
                          Бесплатно
                        </span>
                      )}
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                      {[
                        { label: 'Сотрудники', used: c.workers, limit: limits?.workers ?? null },
                        { label: 'Записи', used: c.appointments, limit: limits?.appointments ?? null },
                        { label: 'Клиенты', used: c.customers, limit: limits?.customers ?? null },
                        { label: 'Автомобили', used: c.vehicles, limit: limits?.vehicles ?? null },
                      ].map((row) => (
                        <div key={row.label} className="space-y-1">
                          <p className="text-xs font-medium text-gray-600">{row.label}</p>
                          <ProgressBar used={row.used} limit={row.limit} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 5: Parts company limits ──────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Лимиты компаний авторазборки
        </h2>
        {partsLoading ? (
          <div className="text-sm text-gray-400 p-4">Загрузка...</div>
        ) : partsCompanies.length === 0 ? (
          <div className="text-sm text-gray-400 p-4 bg-white border rounded-lg">Нет компаний авторазборки</div>
        ) : (
          <div className="space-y-2">
            {partsCompanies.map((c) => {
              const isOpen = expandedParts === c.id
              const limits = c.hasSub ? null : FREE_PARTS
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedParts(isOpen ? null : c.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="font-medium text-sm text-gray-900">{c.name}</span>
                      {!c.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Неактивна</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {c.hasSub ? (
                        <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          {c.subName ?? 'Подписка'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" />
                          Бесплатно
                        </span>
                      )}
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-100 pt-3">
                      {[
                        { label: 'Сотрудники', used: c.workers, limit: limits?.workers ?? null },
                        { label: 'Авто на разборку', used: c.vehicles, limit: limits?.vehicles ?? null },
                        { label: 'Запчасти', used: c.parts, limit: limits?.parts ?? null },
                      ].map((row) => (
                        <div key={row.label} className="space-y-1">
                          <p className="text-xs font-medium text-gray-600">{row.label}</p>
                          <ProgressBar used={row.used} limit={row.limit} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
