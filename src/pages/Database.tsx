import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Users,
  Car,
  Package,
  ShoppingCart,
  Building2,
  Trash2,
  RefreshCw,
  Shield,
  CreditCard,
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
  if (!limit)
    return (
      <span className="kicker text-green-600">∞ Без лимита</span>
    )
  const p = pct(used, limit)
  const color = p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${p}%` }} />
      </div>
      <span className="kicker tabular-nums text-gray-500 whitespace-nowrap">
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
  iconClass: string
}

function TableStatCard({ label, count, icon: Icon, iconClass }: TableStatCardProps) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`icon-tile-sm ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="kicker text-gray-500 truncate">{label}</p>
        <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-tight">
          {count === undefined ? (
            <span className="animate-shimmer inline-block w-10 h-5 rounded" />
          ) : (
            count.toLocaleString('ru-RU')
          )}
        </p>
      </div>
    </div>
  )
}

// ─── section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, iconClass, children }: {
  icon: React.ElementType
  iconClass: string
  children: React.ReactNode
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
      <span className={`icon-tile-sm ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </span>
      {children}
    </h2>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DatabasePage() {
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [expandedParts, setExpandedParts] = useState<string | null>(null)

  // ── 1. Table row counts ──────────────────────────────────────────────────
  const { data: counts } = useQuery({
    queryKey: ['db-counts'],
    queryFn: async () => {
      const tables = [
        'user_profiles',
        'roles',
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
          supabase
            .from(t)
            .select('*', { count: 'exact', head: true })
            .then(({ count }) => [t, count ?? 0] as const)
        )
      )
      return Object.fromEntries(results) as Record<(typeof tables)[number], number>
    },
    staleTime: 30_000,
  })

  // ── 2. Parts companies + subscription + usage ────────────────────────────
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
            supabase
              .from('user_profiles')
              .select('*', { count: 'exact', head: true })
              .eq('parts_company_id', c.id),
            supabase
              .from('parts_vehicles')
              .select('*', { count: 'exact', head: true })
              .eq('parts_company_id', c.id),
            supabase
              .from('parts_inventory')
              .select('*', { count: 'exact', head: true })
              .eq('parts_company_id', c.id),
            supabase
              .from('company_subscriptions')
              .select('*, subscription:subscriptions(name)')
              .eq('company_type', 'parts')
              .eq('company_id', c.id)
              .eq('is_active', true)
              .maybeSingle(),
          ])
          const hasSub =
            !!sub.data && (!sub.data.end_date || new Date(sub.data.end_date) > new Date())
          return {
            ...c,
            workers: workers.count ?? 0,
            vehicles: vehicles.count ?? 0,
            parts: parts.count ?? 0,
            hasSub,
            subName: (sub.data?.subscription as { name?: string } | null)?.name ?? null,
          }
        })
      )
      return results
    },
    staleTime: 30_000,
  })

  // ── 3. Clear expired trash ───────────────────────────────────────────────
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
    queryClient.invalidateQueries({ queryKey: ['db-parts-limits'] })
    toast.success('Данные обновлены')
  }

  // FREE limits (mirrors useSubscription.ts)
  const FREE_PARTS = { workers: 1, vehicles: 1, parts: 10 }

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />

      {/* Header */}
      <div className="page-header mb-0">
        <div>
          <h1 className="page-title">База данных</h1>
          <p className="page-subtitle">Статистика таблиц и лимиты компаний</p>
        </div>
        <button onClick={refreshAll} className="btn-secondary btn-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Обновить
        </button>
      </div>

      {/* ── Section 1: General tables ─────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Users} iconClass="bg-blue-50 text-blue-600">
          Общие таблицы
        </SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <TableStatCard
            label="Пользователи"
            count={counts?.user_profiles}
            icon={Users}
            iconClass="bg-blue-50 text-blue-600"
          />
          <TableStatCard
            label="Роли"
            count={counts?.roles}
            icon={Shield}
            iconClass="bg-purple-50 text-purple-600"
          />
        </div>
      </section>

      {/* ── Section 2: Parts tables ───────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Package} iconClass="bg-orange-50 text-orange-600">
          Таблицы авторазборки
        </SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <TableStatCard
            label="Компании разборки"
            count={counts?.parts_companies}
            icon={Building2}
            iconClass="bg-orange-50 text-orange-600"
          />
          <TableStatCard
            label="Авто на разборку"
            count={counts?.parts_vehicles}
            icon={Car}
            iconClass="bg-amber-50 text-amber-600"
          />
          <TableStatCard
            label="Запчасти"
            count={counts?.parts_inventory}
            icon={Package}
            iconClass="bg-red-50 text-red-600"
          />
          <TableStatCard
            label="Заказы"
            count={counts?.parts_orders}
            icon={ShoppingCart}
            iconClass="bg-pink-50 text-pink-600"
          />
          <TableStatCard
            label="Клиенты разборки"
            count={counts?.parts_customers}
            icon={Users}
            iconClass="bg-rose-50 text-rose-600"
          />
          <TableStatCard
            label="Категории"
            count={counts?.parts_categories}
            icon={Tag}
            iconClass="bg-fuchsia-50 text-fuchsia-600"
          />
        </div>
      </section>

      {/* ── Section 3: Subscriptions + Trash ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TableStatCard
          label="Планы подписок"
          count={counts?.subscriptions}
          icon={CreditCard}
          iconClass="bg-sky-50 text-sky-600"
        />
        <TableStatCard
          label="Активные подписки"
          count={counts?.company_subscriptions}
          icon={CheckCircle}
          iconClass="bg-green-50 text-green-600"
        />

        {/* Корзина — карточка с action */}
        <div className="card flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="icon-tile-sm bg-red-50 text-red-600">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="kicker text-gray-500">Корзина</p>
              <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-tight">
                {counts?.trash_bin === undefined ? (
                  <span className="animate-shimmer inline-block w-10 h-5 rounded" />
                ) : (
                  counts.trash_bin.toLocaleString('ru-RU')
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearTrash}
            disabled={clearTrashMutation.isPending || !counts?.trash_bin}
            className="btn-danger btn-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Очистить
          </button>
        </div>
      </div>

      {/* ── Section 4: Parts company limits ──────────────────────────────── */}
      <section>
        <SectionHeading icon={AlertTriangle} iconClass="bg-yellow-50 text-yellow-600">
          Лимиты компаний авторазборки
        </SectionHeading>

        {partsLoading ? (
          <div className="empty-state py-8">
            <div className="spinner" />
          </div>
        ) : partsCompanies.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">
              <Building2 className="w-7 h-7 text-gray-400" />
            </div>
            <p className="empty-state-title">Нет компаний авторазборки</p>
          </div>
        ) : (
          <div className="space-y-2">
            {partsCompanies.map((c) => {
              const isOpen = expandedParts === c.id
              const limits = c.hasSub ? null : FREE_PARTS
              return (
                <div key={c.id} className="card p-0 overflow-hidden">
                  {/* Accordion header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedParts(isOpen ? null : c.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Package className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="font-semibold text-sm text-gray-900 truncate">{c.name}</span>
                      {!c.is_active && (
                        <span className="badge badge-gray flex-shrink-0">Неактивна</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.hasSub ? (
                        <span className="badge badge-green flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {c.subName ?? 'Подписка'}
                        </span>
                      ) : (
                        <span className="badge badge-yellow flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Бесплатно
                        </span>
                      )}
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded limits */}
                  {isOpen && (
                    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-100 pt-3">
                      {[
                        { label: 'Сотрудники', used: c.workers, limit: limits?.workers ?? null },
                        { label: 'Авто на разборку', used: c.vehicles, limit: limits?.vehicles ?? null },
                        { label: 'Запчасти', used: c.parts, limit: limits?.parts ?? null },
                      ].map((row) => (
                        <div key={row.label} className="space-y-1.5">
                          <p className="kicker text-gray-600">{row.label}</p>
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
      </section>
    </div>
  )
}
