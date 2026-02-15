/**
 * Константы статусов для различных сущностей в системе
 */

// ========== СТАТУСЫ ЗАПИСЕЙ (APPOINTMENTS) ==========
export const APPOINTMENT_STATUSES = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived',
  PENDING_DELETION: 'pending_deletion',
  DELETED: 'deleted'
} as const

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Запланирована',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
  archived: 'Архив',
  pending_deletion: 'На удаление',
  deleted: 'Удалена'
}

export const APPOINTMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-800' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-800' }
}

// ========== СТАТУСЫ ЗАКАЗ-НАРЯДОВ (WORK ORDERS) ==========
export const WORK_ORDER_STATUSES = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  INVOICED: 'invoiced'
} as const

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  completed: 'Выполнен',
  invoiced: 'Выставлен счет'
}

export const WORK_ORDER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-800' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
  invoiced: { bg: 'bg-purple-100', text: 'text-purple-800' }
}

// ========== СТАТУСЫ АВТОМОБИЛЕЙ НА РАЗБОРКЕ ==========
export const PARTS_VEHICLE_STATUSES = {
  IN_STOCK: 'in_stock',
  IN_DISMANTLING: 'in_dismantling',
  DISMANTLED: 'dismantled',
  SOLD: 'sold'
} as const

export const PARTS_VEHICLE_STATUS_LABELS: Record<string, string> = {
  in_stock: 'На складе',
  in_dismantling: 'На разборке',
  dismantled: 'Разобран',
  sold: 'Продан'
}

export const PARTS_VEHICLE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  in_stock: { bg: 'bg-blue-100', text: 'text-blue-800' },
  in_dismantling: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  dismantled: { bg: 'bg-green-100', text: 'text-green-800' },
  sold: { bg: 'bg-gray-100', text: 'text-gray-800' }
}

// ========== ТИПЫ ПОДПИСОК ==========
export const SUBSCRIPTION_TYPES = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime'
} as const

export const SUBSCRIPTION_TYPE_LABELS: Record<string, string> = {
  monthly: 'Месячная',
  yearly: 'Годовая',
  lifetime: 'Пожизненная'
}

// ========== ТИПЫ КОМПАНИЙ ==========
export const COMPANY_TYPES = {
  STO: 'sto',
  PARTS: 'parts'
} as const

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  sto: 'СТО',
  parts: 'Разборка'
}

// ========== СТАТУСЫ ОПЛАТЫ ==========
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue'
} as const

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Не оплачено',
  partial: 'Частично оплачено',
  paid: 'Оплачено',
  overdue: 'Просрочено'
}

export const PAYMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  partial: { bg: 'bg-orange-100', text: 'text-orange-800' },
  paid: { bg: 'bg-green-100', text: 'text-green-800' },
  overdue: { bg: 'bg-red-100', text: 'text-red-800' }
}

// ========== ТИПЫ ЭКСПОРТА ==========
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[keyof typeof APPOINTMENT_STATUSES]
export type WorkOrderStatus = typeof WORK_ORDER_STATUSES[keyof typeof WORK_ORDER_STATUSES]
export type PartsVehicleStatus = typeof PARTS_VEHICLE_STATUSES[keyof typeof PARTS_VEHICLE_STATUSES]
export type SubscriptionType = typeof SUBSCRIPTION_TYPES[keyof typeof SUBSCRIPTION_TYPES]
export type CompanyType = typeof COMPANY_TYPES[keyof typeof COMPANY_TYPES]
export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES]
