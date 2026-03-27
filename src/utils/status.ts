/**
 * Утилиты для работы со статусами заявок и заказов
 */

// Статусы заявок СТО (appointments)
export type AppointmentStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'archived'

export function getAppointmentStatusColor(status: AppointmentStatus): string {
  const colors: Record<AppointmentStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export function getAppointmentStatusText(status: AppointmentStatus): string {
  const statuses: Record<AppointmentStatus, string> = {
    pending: 'Ожидает',
    scheduled: 'Запланировано',
    in_progress: 'В работе',
    completed: 'Завершено',
    cancelled: 'Отменено',
    archived: 'Архив',
  }
  return statuses[status] || status
}

// Статусы заказов запчастей (parts_orders)
export type PartsOrderStatus = 'new' | 'in_progress' | 'completed' | 'cancelled'

export function getPartsOrderStatusColor(status: PartsOrderStatus): string {
  const colors: Record<PartsOrderStatus, string> = {
    new: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

export function getPartsOrderStatusText(status: PartsOrderStatus): string {
  const statuses: Record<PartsOrderStatus, string> = {
    new: 'Новый',
    in_progress: 'В обработке',
    completed: 'Выполнен',
    cancelled: 'Отменен',
  }
  return statuses[status] || status
}

// Универсальная функция для старого кода (deprecated - использовать специфичные функции)
export function getStatusColor(status: string): string {
  return getAppointmentStatusColor(status as AppointmentStatus)
}

export function getStatusText(status: string): string {
  return getAppointmentStatusText(status as AppointmentStatus)
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
