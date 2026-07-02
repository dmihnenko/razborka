import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserPlus, X, ChevronDown } from 'lucide-react'
import { formatPrice } from '@/utils/currency'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsCustomers, sellPart } from '@/services/partsService'
import type { PartsInventoryItem, PartsCustomer } from '@/types/parts'

interface SellPartModalProps {
  item: PartsInventoryItem
  partsCompanyId: string
  onClose: () => void
  onSold?: () => void
}

/**
 * Модалка продажи запчасти. Создаёт клиента (опц.), заказ, позицию заказа,
 * завершает заказ (триггер ставит статус 'sold' и списывает количество).
 * Используется и в списке запчастей, и на карточке товара — без редиректа.
 */
export function SellPartModal({ item, partsCompanyId, onClose, onSold }: SellPartModalProps) {
  const { t } = useTranslation('cabinet')
  const queryClient = useQueryClient()
  const { rate: usdRate } = usePartsExchangeRate()

  const maxQty = item.quantity ?? 1
  const [sellQty, setSellQty] = useState(1)
  const [sellPrice, setSellPrice] = useState(item.selling_price ? String(item.selling_price) : '')
  const [sellCurrency, setSellCurrency] = useState<'UAH' | 'USD'>((item.price_currency as 'UAH' | 'USD') || 'USD')
  const [sellCustomerId, setSellCustomerId] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const { data: customers = [] } = useQuery<PartsCustomer[]>({
    queryKey: ['parts-customers', partsCompanyId],
    queryFn: () => getPartsCustomers(partsCompanyId),
    enabled: !!partsCompanyId,
  })

  const sellMutation = useMutation({
    mutationFn: ({ price, currency, quantity, customerId, newCustomer }: {
      price: number
      currency: 'UAH' | 'USD'
      quantity: number
      customerId?: string
      newCustomer?: { name: string; phone: string }
    }) => sellPart({
      itemId: item.id,
      price,
      currency,
      rate: usdRate,
      quantity,
      customerId: customerId || null,
      newCustomerName: newCustomer?.name,
      newCustomerPhone: newCustomer?.phone,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory-item', item.id] })
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['parts-activity'] })
      toast.success(t('sellPartModal.toastSold'))
      onSold?.()
      onClose()
    },
    onError: (err: unknown) => {
      console.error('Sell error:', err)
      const e = err as { message?: string; error_description?: string }
      const msg = e?.message || e?.error_description || JSON.stringify(err)
      toast.error(t('sellPartModal.toastSaveError', { msg }))
    },
  })

  const handleSell = () => {
    const price = parseFloat(sellPrice)
    if (isNaN(price) || price < 0) {
      toast.error(t('sellPartModal.toastInvalidAmount'))
      return
    }
    if (showNewCustomer && !newCustomerName.trim()) {
      toast.error(t('sellPartModal.toastEnterName'))
      return
    }
    // Продажа в USD требует курс — если он ещё не загрузился, не фиксируем сделку без курса
    if (sellCurrency === 'USD' && usdRate == null) {
      toast.error(t('sellPartModal.toastRateLoading'))
      return
    }
    const qty = Math.max(1, Math.min(maxQty, Math.floor(sellQty) || 1))
    sellMutation.mutate({
      price,
      currency: sellCurrency,
      quantity: qty,
      customerId: sellCustomerId || undefined,
      newCustomer: showNewCustomer ? { name: newCustomerName, phone: newCustomerPhone } : undefined,
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-sheet sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <div className="modal-header">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 leading-tight">{t('sellPartModal.title')}</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{item.name}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon btn-icon-sm ml-3 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* Количество — только для многоштучного товара (частичная продажа) */}
          {maxQty > 1 && (
            <div>
              <label className="form-label">
                {t('sellPartModal.quantity', { defaultValue: 'Количество' })}{' '}
                <span className="text-gray-400 font-normal">/ {maxQty} {t('sellPartModal.inStock', { defaultValue: 'в наличии' })}</span>
              </label>
              <input
                type="number"
                min={1}
                max={maxQty}
                step={1}
                value={sellQty}
                onChange={(e) => setSellQty(Math.max(1, Math.min(maxQty, parseInt(e.target.value, 10) || 1)))}
                className="form-input tabular-nums"
              />
            </div>
          )}

          {/* Цена */}
          <div>
            <label className="form-label">{t('sellPartModal.priceLabel')}</label>
            {item.selling_price && (
              <p className="text-xs text-gray-400 mb-2">
                {t('sellPartModal.announced')}{' '}
                <span className="tabular-nums">
                  {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                </span>
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="0"
                autoFocus
                className="form-input flex-1 tabular-nums"
              />
              <button
                type="button"
                onClick={() => setSellCurrency(c => c === 'USD' ? 'UAH' : 'USD')}
                className="cab-btn cab-btn-primary px-3 w-12 text-center font-semibold tabular-nums"
              >
                {sellCurrency === 'USD' ? '$' : t('sellPartModal.uah')}
              </button>
            </div>
          </div>

          {/* Клиент */}
          <div>
            <label className="form-label">
              {t('sellPartModal.customer')} <span className="text-gray-400 font-normal">{t('sellPartModal.optional')}</span>
            </label>
            {!showNewCustomer ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={sellCustomerId}
                    onChange={(e) => setSellCustomerId(e.target.value)}
                    className="form-select pr-8"
                  >
                    <option value="">{t('sellPartModal.noCustomer')}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}{c.phone ? ` (${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="cab-btn cab-btn-secondary flex items-center gap-1 px-3 flex-shrink-0"
                  title={t('sellPartModal.newCustomer')}
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-gray-700">{t('sellPartModal.newCustomer')}</span>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(false)}
                    className="btn-icon btn-icon-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder={t('sellPartModal.namePlaceholder')}
                    className="form-input"
                  />
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder={t('sellPartModal.phonePlaceholder')}
                    className="form-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <button
            type="button"
            onClick={onClose}
            className="cab-btn cab-btn-secondary flex-1"
          >
            {t('sellPartModal.cancel')}
          </button>
          <button
            type="button"
            disabled={sellMutation.isPending}
            onClick={handleSell}
            className="cab-btn cab-btn-success flex-1"
          >
            {sellMutation.isPending ? t('sellPartModal.saving') : t('sellPartModal.sell')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SellPartModal
