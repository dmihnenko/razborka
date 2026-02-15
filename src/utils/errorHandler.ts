import { toast } from 'sonner'

/**
 * Типы ошибок в системе
 */
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTH = 'auth',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

/**
 * Структура ошибки приложения
 */
export interface AppError {
  type: ErrorType
  message: string
  details?: any
  code?: string
}

/**
 * Определение типа ошибки по коду или сообщению
 */
function getErrorType(error: any): ErrorType {
  if (!navigator.onLine) return ErrorType.NETWORK
  
  if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
    return ErrorType.AUTH
  }
  
  if (error?.code === '42501' || error?.message?.includes('permission')) {
    return ErrorType.PERMISSION
  }
  
  if (error?.code === 'PGRST116' || error?.message?.includes('not found')) {
    return ErrorType.NOT_FOUND
  }
  
  if (error?.code?.startsWith('PGRST') || error?.message?.includes('database')) {
    return ErrorType.SERVER
  }
  
  if (error?.code?.includes('VALIDATION') || error?.name === 'ValidationError') {
    return ErrorType.VALIDATION
  }
  
  return ErrorType.UNKNOWN
}

/**
 * Человекочитаемые сообщения для типов ошибок
 */
const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK]: 'Нет подключения к интернету. Проверьте соединение.',
  [ErrorType.VALIDATION]: 'Проверьте правильность введенных данных.',
  [ErrorType.AUTH]: 'Сессия истекла. Пожалуйста, войдите снова.',
  [ErrorType.PERMISSION]: 'У вас нет прав для выполнения этого действия.',
  [ErrorType.NOT_FOUND]: 'Запрашиваемый ресурс не найден.',
  [ErrorType.SERVER]: 'Ошибка сервера. Попробуйте позже.',
  [ErrorType.UNKNOWN]: 'Произошла неизвестная ошибка.'
}

/**
 * Обработка и нормализация ошибки
 */
export function normalizeError(error: any): AppError {
  const type = getErrorType(error)
  
  return {
    type,
    message: error?.message || ERROR_MESSAGES[type],
    details: error,
    code: error?.code
  }
}

/**
 * Обработчик ошибок с показом уведомления
 */
export function handleError(error: any, customMessage?: string): AppError {
  const normalizedError = normalizeError(error)
  
  const message = customMessage || normalizedError.message
  
  // Логирование в консоль для разработки
  if (process.env.NODE_ENV === 'development') {
    console.error('Error handled:', {
      type: normalizedError.type,
      message,
      details: normalizedError.details
    })
  }
  
  // Показ уведомления пользователю
  switch (normalizedError.type) {
    case ErrorType.AUTH:
      toast.error(message, {
        duration: 5000,
        action: {
          label: 'Войти',
          onClick: () => window.location.href = '/login'
        }
      })
      break
      
    case ErrorType.NETWORK:
      toast.error(message, { duration: 5000 })
      break
      
    case ErrorType.VALIDATION:
      toast.warning(message, { duration: 4000 })
      break
      
    default:
      toast.error(message, { duration: 4000 })
  }
  
  return normalizedError
}

/**
 * Хук для обработки ошибок в компонентах
 */
export function useErrorHandler() {
  return {
    handleError,
    showError: (message: string) => toast.error(message),
    showWarning: (message: string) => toast.warning(message),
    showSuccess: (message: string) => toast.success(message)
  }
}
