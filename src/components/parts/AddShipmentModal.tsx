import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Search, Check } from 'lucide-react'
import {
  createShipment, addShipmentItems, searchInventoryForShipment,
  trackTtn, refreshShipmentStatus, type InventoryPick,
} from '@/services/shipmentsService'
import { getNpApiKey } from '@/utils/npApiKey'

interface Props {
  partsCompanyId: string
  onClose: () => void
}

// Ручное добавление ТТН в «Доставку» + опциональный выбор запчастей в накладной.
export default function AddShipmentModal({ partsCompanyId, onClose }: Props) {
  const { t } = useTranslation('cabinet')
  const queryClient = useQueryClient()
  const [ttn, setTtn] = useState('')
  const [recipient, setRecipient] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InventoryPick[]>([])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['shipment-inventory-search', partsCompanyId, search],
    queryFn: () => searchInventoryForShipment(partsCompanyId, search),
    enabled: !!partsCompanyId,
  })

  const toggle = (it: InventoryPick) =>
    setSelected(prev => prev.some(s => s.id === it.id) ? prev.filter(s => s.id !== it.id) : [...prev, it])

  const createM = useMutation({
    mutationFn: async () => {
      const num = ttn.trim()
      if (!num) throw new Error(t('shipments.ttnRequired', { defaultValue: 'Введите номер ТТН' }))
      const id = await createShipment({
        parts_company_id: partsCompanyId,
        order_id: null,
        ttn: num,
        np_ref: null,
        recipient_name: recipient.trim() || null,
        recipient_phone: null,
        recipient_city: null,
        recipient_warehouse: null,
        status: null,
        status_code: null,
        cod_amount: null,
      })
      await addShipmentItems(id, partsCompanyId, selected.map(s => s.id))
      // best-effort: подтянуть статус из НП сразу, если ключ настроен
      const apiKey = getNpApiKey()
      if (apiKey) {
        try { const st = await trackTtn(num, undefined, apiKey); if (st) await refreshShipmentStatus(id, st) } catch { /* ignore */ }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-shipments', partsCompanyId] })
      toast.success(t('shipments.added', { defaultValue: 'ТТН добавлена' }))
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t('shipments.statusError')),
  })

  const optional = t('shipments.optional', { defaultValue: '(необязательно)' })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">{t('shipments.addTitle', { defaultValue: 'Добавить ТТН' })}</h3>
          <button onClick={onClose} aria-label={t('shipments.close', { defaultValue: 'Закрыть' })}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          <div>
            <label className="form-label">{t('shipments.ttnLabel', { defaultValue: 'Номер ТТН' })}</label>
            <input value={ttn} onChange={e => setTtn(e.target.value)} className="form-input"
              placeholder="20450000000000" autoFocus inputMode="numeric" />
          </div>

          <div>
            <label className="form-label">
              {t('shipments.recipientLabel', { defaultValue: 'Получатель' })} <span className="text-gray-400 font-normal">{optional}</span>
            </label>
            <input value={recipient} onChange={e => setRecipient(e.target.value)} className="form-input" />
          </div>

          <div>
            <label className="form-label">
              {t('shipments.partsLabel', { defaultValue: 'Запчасти в накладной' })} <span className="text-gray-400 font-normal">{optional}</span>
            </label>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selected.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--cab-signal-weak)', color: 'var(--cab-signal)' }}>
                    <span className="truncate max-w-[160px]">{s.name}</span>
                    <button type="button" onClick={() => toggle(s)} aria-label={t('shipments.close', { defaultValue: 'Убрать' })}>
                      <X className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9"
                placeholder={t('shipments.partsSearch', { defaultValue: 'Поиск по названию или номеру' })} />
            </div>

            <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--cab-border)' }}>
              {isFetching ? (
                <p className="text-xs text-gray-400 px-3 py-3">{t('shipments.searching', { defaultValue: 'Поиск…' })}</p>
              ) : results.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-3">{t('shipments.noParts', { defaultValue: 'Ничего не найдено' })}</p>
              ) : results.map(it => {
                const on = selected.some(s => s.id === it.id)
                return (
                  <button key={it.id} type="button" onClick={() => toggle(it)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                    style={{ borderColor: 'var(--cab-border)' }}>
                    <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border"
                      style={on ? { background: 'var(--cab-signal)', borderColor: 'transparent', color: '#fff' } : { borderColor: 'var(--cab-border)' }}>
                      {on && <Check className="w-3 h-3" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate" style={{ color: 'var(--cab-ink)' }}>{it.name}</span>
                      {it.part_number && <span className="block text-[11px] text-gray-400 truncate">{it.part_number}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="modal-btn-cancel">{t('shipments.cancel', { defaultValue: 'Отмена' })}</button>
          <button onClick={() => createM.mutate()} disabled={createM.isPending || !ttn.trim()}
            className="cab-btn cab-btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
            {createM.isPending ? t('shipments.saving', { defaultValue: 'Сохранение…' }) : t('shipments.add', { defaultValue: 'Добавить' })}
          </button>
        </div>
      </div>
    </div>
  )
}
