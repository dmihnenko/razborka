import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { RefreshCw, ExternalLink, PackageOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/utils/date'
import { getShipments, trackTtn, refreshShipmentStatus, type PartsShipment } from '@/services/shipmentsService'
import { useHydrateNpSettings } from '@/hooks/useHydrateNpSettings'
import { getNpApiKey } from '@/utils/npApiKey'

// «Доставка» — агрегированный трекинг ТТН Новой Почты по заказам разборки.

function isDelivered(s: PartsShipment) {
  const code = s.status_code
  // НП: 9,10,11 — получено/доставлено; 14 — отказ; 102/103 — возврат
  return code === '9' || code === '10' || code === '11'
}
function isProblem(s: PartsShipment) {
  const code = s.status_code
  return code === '14' || code === '102' || code === '103' || code === '108'
}

export default function PartsShipments() {
  const { t } = useTranslation('cabinet')
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()
  useHydrateNpSettings(partsCompanyId)
  const [tab, setTab] = useState<'active' | 'delivered' | 'problem' | 'all'>('active')

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['parts-shipments', partsCompanyId],
    queryFn: () => getShipments(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const refreshMutation = useMutation({
    mutationFn: async (s: PartsShipment) => {
      const apiKey = getNpApiKey()
      if (!apiKey) throw new Error(t('shipments.npKeyNeeded'))
      const st = await trackTtn(s.ttn, s.recipient_phone ?? undefined, apiKey)
      if (st) await refreshShipmentStatus(s.id, st)
      return st
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-shipments', partsCompanyId] })
      toast.success(t('shipments.statusUpdated'))
    },
    onError: (e: any) => toast.error(e?.message || t('shipments.statusError')),
  })

  // Массовая проверка статусов всех активных (в пути) посылок
  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      const apiKey = getNpApiKey()
      if (!apiKey) throw new Error(t('shipments.npKeyNeeded'))
      const active = shipments.filter(s => !isDelivered(s) && !isProblem(s))
      let updated = 0
      for (const s of active) {
        try {
          const st = await trackTtn(s.ttn, s.recipient_phone ?? undefined, apiKey)
          if (st) { await refreshShipmentStatus(s.id, st); updated++ }
        } catch { /* пропускаем одну посылку, продолжаем остальные */ }
      }
      return updated
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['parts-shipments', partsCompanyId] })
      toast.success(t('shipments.checkedAll', { n }))
    },
    onError: (e: any) => toast.error(e?.message || t('shipments.statusError')),
  })

  if (!partsCompanyId) return <PartsAccessDenied />

  const counts = {
    all: shipments.length,
    delivered: shipments.filter(isDelivered).length,
    problem: shipments.filter(isProblem).length,
    active: shipments.filter(s => !isDelivered(s) && !isProblem(s)).length,
  }
  const filtered = shipments.filter(s => {
    if (tab === 'all') return true
    if (tab === 'delivered') return isDelivered(s)
    if (tab === 'problem') return isProblem(s)
    return !isDelivered(s) && !isProblem(s)
  })

  const ink = 'var(--cab-ink)', ink2 = 'var(--cab-ink-2)', ink3 = 'var(--cab-ink-3)'

  return (
    <div className="min-h-dvh" style={{ background: 'var(--cab-bg)' }}>
      <PartsPageHeader
        title={t('pages.shipments')}
        subtitle={t('pages.shipmentsSub', { n: counts.all })}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending || counts.active === 0}
            className="cab-btn cab-btn-sm cab-btn-primary"
            title={t('shipments.checkAll')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            <span className="hidden sm:inline">{t('shipments.checkAll')}</span>
          </button>
        }
      />

      <div className="page-container">
        {/* Вкладки-фильтры */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { key: 'active', label: t('shipments.tabActive'), n: counts.active },
            { key: 'delivered', label: t('shipments.tabDelivered'), n: counts.delivered },
            { key: 'problem', label: t('shipments.tabProblem'), n: counts.problem },
            { key: 'all', label: t('shipments.tabAll'), n: counts.all },
          ] as const).map(({ key, label, n }) => (
            <button key={key} onClick={() => setTab(key)}
              className={tab === key ? 'cab-chip cab-chip-signal' : 'cab-chip'}>
              {label}
              {n > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold ${tab === key ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {n}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="md" /></div>
        ) : filtered.length === 0 ? (
          <div className="cab-card p-10 text-center">
            <PackageOpen className="w-9 h-9 mx-auto mb-3" style={{ color: ink3 }} strokeWidth={1.5} />
            <p className="text-sm font-semibold" style={{ color: ink }}>{t('shipments.empty')}</p>
            <p className="text-xs mt-1" style={{ color: ink2 }}>
              {t('shipments.emptyText')}
            </p>
          </div>
        ) : (
          <div className="cab-card p-0 overflow-hidden">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--cab-border)' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums" style={{ color: ink }}>{s.ttn}</span>
                    <a href={`https://novaposhta.ua/tracking/?cargo_number=${s.ttn}`} target="_blank" rel="noreferrer"
                      className="inline-flex" style={{ color: ink3 }} title={t('shipments.openNp')}>
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </a>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: ink2 }}>
                    {s.recipient_name || '—'}
                    {s.order_id && <Link to={`/parts/orders/${s.order_id}`} className="ml-2 font-semibold" style={{ color: 'var(--cab-signal)' }}>{t('shipments.order')}</Link>}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-semibold ${isProblem(s) ? 'text-red-700' : isDelivered(s) ? 'text-emerald-700' : ''}`}
                    style={isProblem(s) || isDelivered(s) ? undefined : { color: ink }}>
                    {s.status || t('shipments.noData')}
                  </p>
                  <p className="text-[11px]" style={{ color: ink3 }}>{formatDate(s.created_at)}</p>
                </div>
                <button onClick={() => refreshMutation.mutate(s)} disabled={refreshMutation.isPending}
                  className="cab-btn cab-btn-sm cab-btn-secondary flex-shrink-0" title={t('shipments.refresh')}>
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
