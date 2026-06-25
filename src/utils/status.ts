/**
 * Утилиты для работы со статусами заказов разборки. Тексты — через i18n (ns cabinet),
 * с русским fallback (старые ключи), чтобы работало даже до загрузки переводов.
 */
import i18n from '@/i18n'

// Статусы заказов запчастей (parts_orders):
// Новый → Сборка → Отправлен → Завершён (+ Отменён). `in_progress` — легаси-алиас (= Сборка).
export type PartsOrderStatus = 'new' | 'assembling' | 'shipped' | 'completed' | 'cancelled' | 'in_progress'

// Последовательность этапов заказа (для кнопок-переходов и канбана).
export const ORDER_FLOW: PartsOrderStatus[] = ['new', 'assembling', 'shipped', 'completed']

/**
 * ЕДИНЫЙ источник класса статус-бейджа заказа (A1 дизайн-аудита).
 * Возвращает ГОТОВЫЙ self-contained класс на базе `badge badge-*` (поддержаны тёмной
 * темой в index.css). Использовать как `<span className={statusBadgeClass(status)}>{text}</span>`
 * во ВСЕХ местах вместо разъехавшихся `cab-chip text-*` / `badge-*` / `bg-*-100`.
 */
export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    new: 'badge badge-blue',
    assembling: 'badge badge-orange',
    in_progress: 'badge badge-orange',
    shipped: 'badge badge-purple',
    completed: 'badge badge-green',
    cancelled: 'badge badge-red',
  }
  return map[status] || 'badge badge-gray'
}

/** @deprecated Использовать statusBadgeClass() — единый бейдж. Оставлено для обратной совместимости. */
export function getPartsOrderStatusColor(status: PartsOrderStatus): string {
  const colors: Record<PartsOrderStatus, string> = {
    new: 'bg-blue-100 text-blue-800',
    assembling: 'bg-amber-100 text-amber-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export function getPartsOrderStatusText(status: PartsOrderStatus): string {
  const ru: Record<PartsOrderStatus, string> = {
    new: 'Новый', assembling: 'Сборка', shipped: 'Отправлен',
    in_progress: 'Сборка', completed: 'Завершён', cancelled: 'Отменён',
  }
  return i18n.t(`cabinet:status.order.${status}`, { defaultValue: ru[status] || status })
}

/** Локализованное состояние запчасти (new/used/damaged). */
export function getPartsConditionLabel(condition: string): string {
  return i18n.t(`cabinet:status.condition.${condition}`, { defaultValue: PARTS_CONDITION_LABELS[condition] ?? condition })
}

export function getOrderStatusColor(status: string): string {
  return getPartsOrderStatusColor(status as PartsOrderStatus)
}

export function getOrderStatusText(status: string): string {
  return getPartsOrderStatusText(status as PartsOrderStatus)
}

// Состояние запчастей в инвентаре (parts inventory)
export const PARTS_CONDITION_LABELS: Record<string, string> = {
  new: 'Новая',
  used: 'Б/У хорошее',
  damaged: 'Повреждена',
}

// Названия месяцев на русском языке
export const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
