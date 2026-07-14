import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, ExternalLink, Package, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/utils/date'
import {
  getShipment, trackTtn, refreshShipmentStatus, formatTtn, vehicleLabel,
  shipmentClient, shipmentPhone,
} from '@/services/shipmentsService'
import { useHydrateNpSettings } from '@/hooks/useHydrateNpSettings'
import { getNpApiKey } from '@/utils/npApiKey'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5" style={{ borderBottom: '1px solid var(--cab-border)' }}>
      <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--cab-ink-3)' }}>{label}</span>
      <span className="text-sm text-right min-w-0 break-words" style={{ color: 'var(--cab-ink)' }}>{children}</span>
    </div>
  )
}

export default function PartsShipmentDetails() {
  const { t } = useTranslation('cabinet')
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id ?? undefined
  const queryClient = useQueryClient()
  useHydrateNpSettings(partsCompanyId)

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['parts-shipment', id],
    queryFn: () => getShipment(id!),
    enabled: !!id,
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!shipment) return
      const apiKey = getNpApiKey()
      if (!apiKey) throw new Error(t('shipments.npKeyNeeded'))
      const st = await trackTtn(shipment.ttn, shipment.recipient_phone ?? undefined, apiKey)
      if (st) await refreshShipmentStatus(shipment.id, st)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-shipment', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-shipments'] })
      toast.success(t('shipments.statusUpdated'))
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('shipments.statusError')),
  })

  if (!partsCompanyId) return <PartsAccessDenied />
  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="md" /></div>
  if (!shipment) {
    return (
      <div className="page-container">
        <div className="cab-card p-10 text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--cab-ink)' }}>{t('shipments.notFound', { defaultValue: 'ТТН не найдена' })}</p>
          <button onClick={() => navigate('/parts/shipments')} className="cab-btn cab-btn-secondary cab-btn-sm mt-4">
            {t('shipments.backToList', { defaultValue: 'К списку' })}
          </button>
        </div>
      </div>
    )
  }

  const client = shipmentClient(shipment)
  const phone = shipmentPhone(shipment)
  const cod = shipment.cod_amount

  // «Открыть на НП» + копируем номер в буфер (сайт НП не всегда автозаполняет поиск из URL).
  const openNp = () => {
    navigator.clipboard?.writeText(shipment.ttn).catch(() => { /* ignore */ })
    toast.success(t('shipments.ttnCopied', { defaultValue: 'Номер скопирован — вставьте в поиск НП' }))
    window.open(`https://novaposhta.ua/tracking/?cargo_number=${shipment.ttn}`, '_blank', 'noopener')
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--cab-bg)' }}>
      <PartsPageHeader
        title={`${t('shipments.ttnLabel', { defaultValue: 'ТТН' })} ${formatTtn(shipment.ttn)}`}
        subtitle={shipment.status || t('shipments.noData')}
        backPath="/parts/shipments"
        actions={
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="cab-btn cab-btn-sm cab-btn-primary"
            title={t('shipments.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            <span className="hidden sm:inline">{t('shipments.refresh')}</span>
          </button>
        }
      />

      <div className="page-container space-y-4">
        <div className="cab-card p-4">
          <Row label={t('shipments.colStatus', { defaultValue: 'Статус' })}>
            {shipment.status || t('shipments.noData')}
          </Row>
          {shipment.order && (
            <Row label={t('shipments.colOrder', { defaultValue: '№ Заказа' })}>
              <Link to={`/parts/orders/${shipment.order.id}`} className="font-semibold" style={{ color: 'var(--cab-signal)' }}>
                {shipment.order.order_number || t('shipments.order')}
              </Link>
            </Row>
          )}
          {client && (
            <Row label={t('shipments.colClient', { defaultValue: 'Клиент' })}>{client}</Row>
          )}
          {phone && (
            <Row label={t('shipments.colPhone', { defaultValue: 'Телефон' })}>
              <a href={`tel:${phone}`} className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--cab-signal)' }}>
                <Phone className="w-3.5 h-3.5" strokeWidth={1.5} /> {phone}
              </a>
            </Row>
          )}
          {shipment.recipient_city && (
            <Row label={t('shipments.colCity', { defaultValue: 'Город' })}>{shipment.recipient_city}</Row>
          )}
          {shipment.recipient_warehouse && (
            <Row label={t('shipments.colWarehouse', { defaultValue: 'Отделение' })}>{shipment.recipient_warehouse}</Row>
          )}
          {cod != null && cod > 0 && (
            <Row label={t('shipments.colCod', { defaultValue: 'Наложенный платёж' })}>{cod.toLocaleString('ru-RU')} ₴</Row>
          )}
          <Row label={t('shipments.colCreated', { defaultValue: 'Создана' })}>{formatDate(shipment.created_at)}</Row>

          <button onClick={openNp} className="cab-btn cab-btn-secondary cab-btn-sm mt-3">
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('shipments.openNp')}
          </button>
        </div>

        {shipment.items && shipment.items.length > 0 && (
          <div className="cab-card p-0 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--cab-border)' }}>
              <Package className="w-4 h-4" style={{ color: 'var(--cab-ink-3)' }} strokeWidth={1.5} />
              <span className="text-sm font-semibold" style={{ color: 'var(--cab-ink)' }}>
                {t('shipments.partsLabel', { defaultValue: 'Запчасти в накладной' })}
              </span>
              <span className="text-xs" style={{ color: 'var(--cab-ink-3)' }}>{shipment.items.length}</span>
            </div>
            {shipment.items.map((it) => {
              const v = vehicleLabel(it.item?.vehicle)
              return (
                <div key={it.inventory_item_id} className="px-4 py-2.5 flex items-center gap-3"
                  style={{ borderBottom: '1px solid var(--cab-border)' }}>
                  <Link to={`/parts/inventory/${it.inventory_item_id}`} className="min-w-0 flex-1">
                    <span className="block text-sm truncate" style={{ color: 'var(--cab-ink)' }}>{it.item?.name || '—'}</span>
                    {(it.item?.part_number || v) && (
                      <span className="block text-[11px] truncate" style={{ color: 'var(--cab-ink-3)' }}>
                        {[it.item?.part_number, v].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
