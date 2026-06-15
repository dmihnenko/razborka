import { useState } from 'react'
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
      if (!apiKey) throw new Error('Укажите API-ключ Новой почты в настройках')
      const st = await trackTtn(s.ttn, s.recipient_phone ?? undefined, apiKey)
      if (st) await refreshShipmentStatus(s.id, st)
      return st
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-shipments', partsCompanyId] })
      toast.success('Статус обновлён')
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось обновить статус'),
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
      <PartsPageHeader title="Доставка" subtitle={`Посылок: ${counts.all}`} backPath="/parts/dashboard" />

      <div className="page-container">
        {/* Вкладки-фильтры */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { key: 'active', label: 'В пути', n: counts.active },
            { key: 'delivered', label: 'Получено', n: counts.delivered },
            { key: 'problem', label: 'Проблемные', n: counts.problem },
            { key: 'all', label: 'Все', n: counts.all },
          ] as const).map(({ key, label, n }) => (
            <button key={key} onClick={() => setTab(key)}
              className="cab-btn cab-btn-sm"
              style={tab === key
                ? { background: 'var(--cab-ink)', color: '#fff', border: '1px solid var(--cab-ink)' }
                : { background: 'var(--cab-surface)', color: ink2, border: '1px solid var(--cab-border-strong)' }}>
              {label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="md" /></div>
        ) : filtered.length === 0 ? (
          <div className="cab-card p-10 text-center">
            <PackageOpen className="w-9 h-9 mx-auto mb-3" style={{ color: ink3 }} strokeWidth={1.5} />
            <p className="text-sm font-semibold" style={{ color: ink }}>Посылок нет</p>
            <p className="text-xs mt-1" style={{ color: ink2 }}>
              Накладные ТТН создаются в заказе — появятся здесь для отслеживания.
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
                      className="inline-flex" style={{ color: ink3 }} title="Открыть на НП">
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </a>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: ink2 }}>
                    {s.recipient_name || '—'}
                    {s.order_id && <Link to={`/parts/orders/${s.order_id}`} className="ml-2 font-semibold" style={{ color: 'var(--cab-signal)' }}>заказ</Link>}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold" style={{ color: isProblem(s) ? '#B91C1C' : isDelivered(s) ? '#15803D' : ink }}>
                    {s.status || 'Нет данных'}
                  </p>
                  <p className="text-[11px]" style={{ color: ink3 }}>{formatDate(s.created_at)}</p>
                </div>
                <button onClick={() => refreshMutation.mutate(s)} disabled={refreshMutation.isPending}
                  className="cab-btn cab-btn-sm cab-btn-secondary flex-shrink-0" title="Обновить статус">
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
