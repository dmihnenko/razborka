import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { useAlert } from '@/components/CustomAlert'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { PartsStockError, partsErrorMessage } from '@/services/partsService'
import { createPartsSale } from '@/services/partsSaleService'
import { formatPrice } from '@/utils/currency'
import { CustomerPicker } from './CustomerPicker'
import { SaleItems } from './SaleItems'
import {
  buildSalePlan,
  calcTotals,
  defaultSaleMode,
  validateSale,
  type CustomerChoice,
  type SaleIssue,
  type SaleLine,
  type SaleMode,
  type SaleSource,
} from './saleLogic'

export interface SaleSheetProps {
  open: boolean
  onClose: () => void
  /** Предзаполненные позиции (со склада). Пустой массив — добавляются поиском внутри формы. */
  initialItems?: SaleLine[]
  initialCustomer?: CustomerChoice
  source: SaleSource
  /** Вызывается после успешного оформления с id созданного заказа */
  onDone?: (orderId: string) => void
}

/**
 * Единая форма продажи: клиент → позиции → итог → комментарий.
 * Режим «Оформить продажу» завершает заказ сразу (как продажа со склада),
 * «Заказ в работе» — резервирует позиции и оставляет заказ новым.
 */
export function SaleSheet({ open, onClose, initialItems = [], initialCustomer, source, onDone }: SaleSheetProps) {
  const { t } = useTranslation('cabinet')
  const { showAlert } = useAlert()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id ?? undefined
  const { rate } = usePartsExchangeRate()

  const [lines, setLines] = useState<SaleLine[]>(initialItems)
  const [customer, setCustomer] = useState<CustomerChoice>(initialCustomer ?? { kind: 'none' })
  const [mode, setMode] = useState<SaleMode>(defaultSaleMode(source))
  const [notes, setNotes] = useState('')
  // Номер «сессии» формы: растёт при каждом открытии и закрытии — старые колбэки не трогают новую форму
  const sessionRef = useRef(0)

  // Каждое открытие — чистая форма с предзаполненными данными сценария
  useEffect(() => {
    sessionRef.current += 1
    if (!open) return
    setLines(initialItems)
    setCustomer(initialCustomer ?? { kind: 'none' })
    setMode(defaultSaleMode(source))
    setNotes('')
  }, [open])

  const mutation = useMutation({
    mutationFn: (vars: { session: number }) => {
      const plan = buildSalePlan(lines, { mode, rate, customer, notes })
      return createPartsSale(partsCompanyId!, plan, {
        // Клиент уже создан — при повторе после ошибки используем его, а не создаём дубль
        onCustomerCreated: (id) => {
          queryClient.invalidateQueries({ queryKey: ['parts-customers-dropdown', partsCompanyId] })
          queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
          if (sessionRef.current === vars.session) setCustomer({ kind: 'existing', id })
        },
      })
    },
    onSuccess: ({ finalizeFailed }) => {
      // Объединение ключей всех прежних путей продажи
      for (const key of [
        'parts-orders', 'parts-order', 'parts-inventory', 'parts-inventory-item', 'parts-inventory-for-order',
        'parts-customers', 'parts-customers-dropdown', 'parts-dashboard-stats', 'parts-recent-activity',
        'parts-analytics', 'vehicle-roi', 'vehicle-parts', 'parts-vehicle', 'parts-orders-stats',
        'parts-customer-orders', 'parts-location-items', 'parts-activity-log',
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      toast.success(
        mode === 'reserve'
          ? t('saleSheet.toastReserved', { defaultValue: 'Заказ создан, позиции в резерве' })
          : lines.length > 1
            ? t('inventoryPage.toastBulkSold', { n: lines.length })
            : t('inventoryPage.toastSold'),
      )
      if (finalizeFailed) {
        showAlert(
          t('saleSheet.finalizeFailed', {
            defaultValue: 'Продажа оформлена, но метки «продано» (цена и покупатель) проставились не у всех позиций. Поправьте их в карточке позиции.',
          }),
          'info',
        )
      }
    },
    onError: (err: unknown) => {
      console.error('Sale error:', err)
      // Остаток могли изменить в другом окне — обновим список доступных позиций
      queryClient.invalidateQueries({ queryKey: ['parts-inventory-for-order'] })
      const e = err as { message?: string; error_description?: string } | null
      const msg = (err instanceof PartsStockError ? partsErrorMessage(err, t) : '') || e?.message || e?.error_description || JSON.stringify(err)
      showAlert(
        err instanceof PartsStockError ? msg : t('inventoryPage.toastSaveErrorMsg', { msg }),
        'error',
      )
    },
  })

  const issueMessage = (i: SaleIssue): string => {
    switch (i.code) {
      case 'noItems': return t('saleSheet.errNoItems', { defaultValue: 'Добавьте хотя бы одну позицию' })
      case 'badQty': return t('saleSheet.errQty', { defaultValue: 'Укажите количество для: {{name}}', name: i.name })
      case 'overStock': return `${i.name}: ${t('orderDetailsPage.notEnoughParts', { n: i.available })}`
      case 'badPrice': return t('inventoryPage.enterPriceFor', { name: i.name })
      case 'rateMissing': return t('inventoryPage.rateLoading')
      case 'customerName': return t('inventoryPage.enterCustomerName')
    }
  }

  const submit = () => {
    if (!partsCompanyId || mutation.isPending) return
    const issue = validateSale(lines, { mode, rate, customer })
    if (issue) {
      showAlert(issueMessage(issue), 'error')
      return
    }
    const session = sessionRef.current
    mutation.mutate({ session }, {
      // Per-call: не сработает после размонтирования; сессия защищает от повторного открытия
      onSuccess: ({ orderId }) => {
        if (sessionRef.current !== session) return
        onDone?.(orderId) // экран-хозяин при успехе навигирует сам и игнорирует onClose
        onClose()
      },
    })
  }

  const handleClose = () => {
    if (mutation.isPending) return
    onClose()
  }

  const totals = calcTotals(lines, rate)
  const title = source === 'manual'
    ? t('saleSheet.titleNew', { defaultValue: 'Новая продажа' })
    : lines.length > 1 ? t('inventoryPage.bulkSellTitle') : t('inventoryPage.sellPart')

  const submitLabel = mutation.isPending
    ? t('inventoryPage.saving')
    : mode === 'reserve'
      ? t('saleSheet.submitReserve', { defaultValue: 'Создать заказ' })
      : t('saleSheet.submitSell', { defaultValue: 'Оформить продажу' })

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title={title}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={handleClose} disabled={mutation.isPending} className="cab-btn cab-btn-secondary disabled:opacity-50">
            {t('inventoryPage.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={mutation.isPending || !partsCompanyId}
            className="cab-btn cab-btn-primary disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      }
    >
      {partsCompanyId && (
        <div className="space-y-4">
          {/* Режим: продать сразу или завести заказ в работе */}
          <div>
            <div className="flex gap-2">
              {(['sell', 'reserve'] as SaleMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={mode === m ? 'cab-chip cab-chip-signal' : 'cab-chip'}
                  aria-pressed={mode === m}
                >
                  {m === 'sell'
                    ? t('saleSheet.modeSell', { defaultValue: 'Продажа' })
                    : t('saleSheet.modeReserve', { defaultValue: 'Заказ в работе' })}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {mode === 'sell'
                ? t('saleSheet.modeSellHint', { defaultValue: 'Заказ завершится сразу, склад спишется' })
                : t('saleSheet.modeReserveHint', { defaultValue: 'Позиции в резерве, заказ можно завершить позже' })}
            </p>
          </div>

          <div>
            <label className="form-label">
              {t('inventoryPage.customer')} <span className="text-gray-400 font-normal">{t('inventoryPage.optional')}</span>
            </label>
            <CustomerPicker partsCompanyId={partsCompanyId} value={customer} onChange={setCustomer} />
          </div>

          <div>
            <label className="form-label">{t('saleSheet.items', { defaultValue: 'Позиции' })}</label>
            <SaleItems partsCompanyId={partsCompanyId} lines={lines} onChange={setLines} />
          </div>

          <div>
            <label className="form-label" htmlFor="sale-notes">{t('saleSheet.comment', { defaultValue: 'Комментарий' })}</label>
            <textarea
              id="sale-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="form-input resize-none"
              placeholder={t('createOrderPage.notesPlaceholder')}
            />
          </div>

          {lines.length > 0 && (
            <div className="flex items-baseline justify-between border-t border-gray-100 pt-3">
              <span className="kicker">{t('orderDetailsPage.total')}</span>
              <span className="text-right">
                <span className="block text-lg font-bold text-gray-900 tabular-nums leading-none">
                  {totals.totalUah != null ? formatPrice(Math.round(totals.totalUah), 'UAH') : formatPrice(totals.usd, 'USD')}
                </span>
                {totals.hasUsd && totals.totalUah != null && (
                  <span className="block text-xs text-gray-400 tabular-nums mt-1">
                    {formatPrice(totals.usd, 'USD')}{totals.uah > 0 ? ` + ${formatPrice(totals.uah, 'UAH')}` : ''}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
