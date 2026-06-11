import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Phone, MapPin, Mail, Building2, Store,
  ClipboardList, Users, Car, Wrench, Tag, Package, ShoppingCart, UserCircle,
  CreditCard, Power, PowerOff,
} from 'lucide-react'
import type { CompanyDetail } from '@/services/companyStatsService'
import { setCompanyActive } from '@/services/companyStatsService'
import { isCompanyActive } from '@/utils/company'

const STAT_ICONS: Record<string, { Icon: any; cls: string }> = {
  appointments: { Icon: ClipboardList, cls: 'bg-violet-50 text-violet-600' },
  customers:    { Icon: UserCircle,    cls: 'bg-blue-50 text-blue-600' },
  vehicles:     { Icon: Car,           cls: 'bg-emerald-50 text-emerald-600' },
  workOrders:   { Icon: Wrench,        cls: 'bg-amber-50 text-amber-600' },
  services:     { Icon: Tag,           cls: 'bg-pink-50 text-pink-600' },
  workers:      { Icon: Users,         cls: 'bg-indigo-50 text-indigo-600' },
  inventory:    { Icon: Package,       cls: 'bg-orange-50 text-orange-600' },
  partsVehicles:{ Icon: Car,           cls: 'bg-emerald-50 text-emerald-600' },
  orders:       { Icon: ShoppingCart,  cls: 'bg-violet-50 text-violet-600' },
}

interface Props {
  detail?: CompanyDetail
  isLoading: boolean
  kind: 'sto' | 'parts'
  backPath: string
}

export function CompanyStatsView({ detail, isLoading, kind, backPath }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const KindIcon = kind === 'sto' ? Building2 : Store
  const kindLabel = kind === 'sto' ? 'СТО' : 'Разборка'
  const company = detail?.company
  const queryKey = [`${kind}-company-detail`, company?.id]

  const toggleActive = useMutation({
    mutationFn: () => setCompanyActive(kind, company!.id, !isCompanyActive(company!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success(isCompanyActive(company!) ? 'Компания приостановлена' : 'Компания активирована')
    },
    onError: () => toast.error('Не удалось изменить статус'),
  })

  return (
    <div className="container-mobile">
      {/* Назад */}
      <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Назад к списку
      </button>

      {/* Шапка компании */}
      <div className="card mb-4 sm:mb-6">
        {isLoading || !company ? (
          <div className="h-16 flex items-center text-gray-400 text-sm">Загрузка…</div>
        ) : (
          <div className="flex items-start gap-3 sm:gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${kind === 'sto' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
              <KindIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">{company.name}</h1>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isCompanyActive(company) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {isCompanyActive(company) ? 'Активна' : 'Приостановлена'}
                </span>
                <span className="text-[11px] text-gray-400">{kindLabel}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                {company.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{company.phone}</span>}
                {company.address && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{company.address}</span>}
                {company.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{company.email}</span>}
              </div>
            </div>
            {/* Приостановить / активировать */}
            <button
              onClick={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                isCompanyActive(company)
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isCompanyActive(company) ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isCompanyActive(company) ? 'Приостановить' : 'Активировать'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Подписка */}
      {!isLoading && detail && (
        <div className="card mb-4 sm:mb-6 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${detail.subscription ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
            <CreditCard className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Подписка</p>
            {detail.subscription ? (
              <p className="text-sm font-semibold text-gray-900">
                {detail.subscription.name}
                {detail.subscription.type && <span className="text-gray-400 font-normal"> · {detail.subscription.type === 'lifetime' ? 'бессрочная' : detail.subscription.type === 'monthly' ? 'месячная' : detail.subscription.type}</span>}
              </p>
            ) : (
              <p className="text-sm font-medium text-amber-600">Без активной подписки</p>
            )}
          </div>
        </div>
      )}

      {/* Статистика */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Статистика</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {(isLoading || !detail
          ? Array.from({ length: 6 }).map((_, i) => ({ key: `s${i}`, label: '', value: -1 }))
          : detail.stats
        ).map((s) => {
          const cfg = STAT_ICONS[s.key] || { Icon: Building2, cls: 'bg-gray-50 text-gray-500' }
          const loading = s.value < 0
          return (
            <div key={s.key} className="stat-card">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${cfg.cls}`}>
                <cfg.Icon className="w-4.5 h-4.5" />
              </div>
              {loading ? (
                <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
              ) : (
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none">{s.value}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">{s.label || ' '}</p>
            </div>
          )
        })}
      </div>

      {/* Сотрудники */}
      {!isLoading && detail && detail.workers.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            Сотрудники · {detail.workers.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {detail.workers.map(w => (
              <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {(w.full_name?.charAt(0) || w.email?.charAt(0) || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{w.full_name || 'Без имени'}</p>
                  <p className="text-xs text-gray-400 truncate">{w.email}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${w.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {w.is_active ? 'Активен' : 'Неактивен'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyStatsView
