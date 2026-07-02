import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Phone, MapPin, Mail, Store,
  Users, Car, Package, ShoppingCart, UserCircle,
  CreditCard, Power, PowerOff, Building2,
} from 'lucide-react'
import { fetchPartsCompanyDetail, setCompanyActive } from '@/services/companyStatsService'
import type { CompanyStat } from '@/services/companyStatsService'

/* ── Icon map for stat tiles ─────────────────────────────── */
const STAT_ICONS: Record<string, { Icon: React.ElementType; tile: string }> = {
  customers:    { Icon: UserCircle,   tile: 'bg-blue-50 text-blue-600' },
  workers:      { Icon: Users,        tile: 'bg-indigo-50 text-indigo-600' },
  inventory:    { Icon: Package,      tile: 'bg-orange-50 text-orange-600' },
  partsVehicles:{ Icon: Car,          tile: 'bg-emerald-50 text-emerald-600' },
  orders:       { Icon: ShoppingCart, tile: 'bg-violet-50 text-violet-600' },
}

/* ── Skeleton stat tile ──────────────────────────────────── */
function StatSkeleton() {
  return (
    <div className="stat-card">
      <div className="icon-tile bg-gray-100 animate-shimmer mb-3" />
      <div className="h-7 w-12 rounded-lg bg-gray-100 animate-shimmer mb-1.5" />
      <div className="h-3 w-16 rounded bg-gray-100 animate-shimmer" />
    </div>
  )
}

/* ── Stat tile ───────────────────────────────────────────── */
function StatTile({ s }: { s: CompanyStat }) {
  const cfg = STAT_ICONS[s.key] ?? { Icon: Building2, tile: 'bg-gray-50 text-gray-500' }
  return (
    <div className="stat-card">
      <div className={`icon-tile mb-3 ${cfg.tile}`}>
        <cfg.Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-none tabular">
        {s.value}
      </p>
      <p className="text-xs text-gray-500 mt-1 truncate">{s.label}</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════ */
export default function PartsCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const queryKey      = ['parts-company-detail', companyId]

  const { data: detail, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchPartsCompanyDetail(companyId!),
    enabled: !!companyId,
  })

  const company = detail?.company

  const toggleActive = useMutation({
    mutationFn: () => setCompanyActive('parts', company!.id, !company!.is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success(company!.is_active ? 'Компания приостановлена' : 'Компания активирована')
    },
    onError: () => toast.error('Не удалось изменить статус'),
  })

  return (
    <div className="page-container space-y-5">

      {/* ── Sticky page header ─────────────────────────────── */}
      {/* Отрицательные mx синхронизированы с px контейнера AdminLayout (px-4 sm:px-5),
          чтобы шапка ровно доходила до краёв контента без двойного паддинга. */}
      <div className="sticky top-0 z-20 glass -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 border-b border-gray-100">
        <div className="page-header mb-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/admin/parts-companies')}
              className="btn-icon flex-shrink-0"
              aria-label="Назад к списку"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="kicker">Разборка</p>
              <h1 className="page-title truncate">
                {isLoading || !company ? 'Загрузка…' : company.name}
              </h1>
            </div>
          </div>

          {/* Toggle active — только когда данные загружены */}
          {!isLoading && company && (
            <button
              onClick={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
              className={`btn cab-btn-sm flex-shrink-0 ${
                company.is_active
                  ? 'cab-btn cab-btn-secondary text-amber-700 border-amber-200 hover:border-amber-300'
                  : 'cab-btn cab-btn-success'
              }`}
            >
              {company.is_active
                ? <><PowerOff className="w-3.5 h-3.5" /><span className="hidden sm:inline">Приостановить</span></>
                : <><Power    className="w-3.5 h-3.5" /><span className="hidden sm:inline">Активировать</span></>}
            </button>
          )}
        </div>
      </div>

      {/* ── Hero card ──────────────────────────────────────── */}
      <div className="card animate-fade-in">
        {isLoading || !company ? (
          <div className="flex items-center gap-3">
            <div className="icon-tile-lg bg-gray-100 animate-shimmer flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 rounded-lg bg-gray-100 animate-shimmer" />
              <div className="h-3 w-56 rounded bg-gray-100 animate-shimmer" />
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            {/* Иконка */}
            <div className="icon-tile-lg bg-orange-50 text-orange-600 flex-shrink-0">
              <Store className="w-6 h-6" />
            </div>

            {/* Инфо */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h2 className="heading-3 truncate">{company.name}</h2>
                <span className={`badge ${company.is_active ? 'badge-green' : 'badge-gray'}`}>
                  {company.is_active ? 'Активна' : 'Приостановлена'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {company.phone   && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone  className="w-3.5 h-3.5 flex-shrink-0" />{company.phone}
                  </span>
                )}
                {company.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />{company.address}
                  </span>
                )}
                {company.email   && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail   className="w-3.5 h-3.5 flex-shrink-0" />{company.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Subscription card ──────────────────────────────── */}
      {!isLoading && detail && (
        <div className="card flex items-center gap-3 animate-fade-in">
          <div className={`icon-tile flex-shrink-0 ${detail.subscription ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="kicker mb-0.5">Подписка</p>
            {detail.subscription ? (
              <p className="text-sm font-semibold text-gray-900 truncate">
                {detail.subscription.name}
                {detail.subscription.type && (
                  <span className="font-normal text-gray-400">
                    {' · '}
                    {detail.subscription.type === 'lifetime'
                      ? 'бессрочная'
                      : detail.subscription.type === 'monthly'
                        ? 'месячная'
                        : detail.subscription.type}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm font-medium text-amber-600">Без активной подписки</p>
            )}
          </div>
          {detail.subscription && (
            <span className="badge badge-green flex-shrink-0">Активна</span>
          )}
        </div>
      )}

      {/* ── Stats section ──────────────────────────────────── */}
      <section>
        <p className="kicker mb-3">Статистика</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {isLoading || !detail
            ? Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
            : detail.stats.map(s => <StatTile key={s.key} s={s} />)
          }
        </div>
      </section>

      {/* ── Workers section ────────────────────────────────── */}
      {!isLoading && detail && (
        <section>
          <p className="kicker mb-3">
            Сотрудники
            {detail.workers.length > 0 && (
              <span className="ml-1.5 badge badge-gray">{detail.workers.length}</span>
            )}
          </p>

          {detail.workers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Users className="w-7 h-7 text-gray-400" />
              </div>
              <p className="empty-state-title">Сотрудников нет</p>
              <p className="empty-state-text">Сотрудники появятся после регистрации в компании</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-slide-up">
              {detail.workers.map(w => (
                <div key={w.id} className="card flex items-center gap-3 !p-3">
                  {/* Avatar initials */}
                  <div className="avatar-md text-white font-bold flex-shrink-0" style={{ background: 'var(--cab-signal)' }}>
                    {(w.full_name?.charAt(0) || w.email?.charAt(0) || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {w.full_name || 'Без имени'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{w.email}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${w.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {w.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
