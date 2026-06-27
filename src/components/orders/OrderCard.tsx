import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Phone,
  Send,
  XCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru, uk } from 'date-fns/locale'
import { formatPrice } from '@/utils/currency'
import type { MyMarketplaceOrder } from '@/types/marketplace'
import i18n from '@/i18n'

const NO_IMAGE_URL = '/noimage_final.png'

// Бейдж статуса заявки маркета (new / viewed / closed / cancelled) — цвета как в кабинете разборки.
export const STATUS_CHIP: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  viewed: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
}

export function dateLocale() {
  return i18n.language?.startsWith('uk') ? uk : ru
}

/** Суммируем заказ по валютам (товары разных валют показываем раздельно). */
export function totalsByCurrency(order: MyMarketplaceOrder): { currency: 'UAH' | 'USD'; sum: number }[] {
  const map = new Map<'UAH' | 'USD', number>()
  for (const it of order.items) {
    const line = (it.sellingPrice ?? 0) * (it.quantity || 1)
    map.set(it.priceCurrency, (map.get(it.priceCurrency) ?? 0) + line)
  }
  // Если позиций нет, но есть итог — показываем его в гривне (как в кабинете разборки).
  if (map.size === 0 && order.totalAmount) return [{ currency: 'UAH', sum: order.totalAmount }]
  return Array.from(map.entries()).map(([currency, sum]) => ({ currency, sum }))
}

export default function OrderCard({
  order,
  onCancel,
  canceling,
}: {
  order: MyMarketplaceOrder
  onCancel: (order: MyMarketplaceOrder) => void
  canceling: boolean
}) {
  const { t } = useTranslation('cabinet')
  const [itemsOpen, setItemsOpen] = useState(false)

  const statusKey =
    order.status === 'cancelled'
      ? 'statusCancelled'
      : order.status === 'closed'
        ? 'statusClosed'
        : order.status === 'viewed'
          ? 'statusViewed'
          : 'statusNew'
  // Покупатель может отменить только пока разборка не приняла/не закрыла заявку.
  const canCancel = order.status === 'new' || order.status === 'viewed'
  const totals = totalsByCurrency(order)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Шапка: разборка + статус */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {order.company?.name || t('myOrdersPage.title')}
            </p>
            {order.company?.city && (
              <p className="text-xs text-gray-400 mt-0.5">{order.company.city}</p>
            )}
          </div>
          <span
            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              STATUS_CHIP[order.status] || STATUS_CHIP.closed
            }`}
          >
            {t(`myOrdersPage.${statusKey}`)}
          </span>
        </div>

        {/* Контакты разборки */}
        {(order.company?.phone || order.company?.telegram) && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {order.company?.phone && (
              <a
                href={`tel:${order.company.phone}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                {t('myOrdersPage.call')}
              </a>
            )}
            {order.company?.telegram && (
              <a
                href={`https://t.me/${order.company.telegram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                {t('myOrdersPage.telegram')}
              </a>
            )}
          </div>
        )}

        {/* Дата + итог */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-400 min-w-0">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: dateLocale() })}
            </span>
          </div>
          <div className="text-right shrink-0">
            {totals.map((tt) => (
              <span key={tt.currency} className="block text-sm font-bold text-blue-600 leading-tight">
                {formatPrice(tt.sum, tt.currency)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Тоггл позиций */}
      {order.items.length > 0 && (
        <button
          onClick={() => setItemsOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-4 py-2 border-t border-gray-100 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          {itemsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {itemsOpen ? t('myOrdersPage.toggleHide') : t('myOrdersPage.itemsCount', { count: order.items.length })}
        </button>
      )}

      {/* Раскрытые позиции */}
      {itemsOpen && order.items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 space-y-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <img
                src={item.photoUrl || NO_IMAGE_URL}
                alt={item.name}
                className="w-12 h-12 rounded-lg object-cover bg-white border border-gray-100 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.quantity} {t('myOrdersPage.qtyShort')} × {formatPrice(item.sellingPrice, item.priceCurrency)}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-700 shrink-0">
                {formatPrice((item.sellingPrice ?? 0) * (item.quantity || 1), item.priceCurrency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-xs font-semibold text-gray-600">{t('myOrdersPage.total')}</span>
            <div className="text-right">
              {totals.map((tt) => (
                <span key={tt.currency} className="block text-sm font-bold text-blue-600 leading-tight">
                  {formatPrice(tt.sum, tt.currency)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Комментарий */}
      {order.comment && (
        <div className="border-t border-blue-100 px-4 py-2.5 bg-blue-50/60">
          <p className="text-xs text-gray-600">{order.comment}</p>
        </div>
      )}

      {/* Отмена заявки — только пока разборка не приняла/не закрыла её */}
      {canCancel && (
        <div className="border-t border-gray-100 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onCancel(order)}
            disabled={canceling}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
            {t('myOrdersPage.cancelOrder')}
          </button>
        </div>
      )}
    </div>
  )
}
