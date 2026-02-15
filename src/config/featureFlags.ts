/**
 * Конфигурация Feature Flags
 * Используется для включения/выключения функциональности в продакшене
 */

export interface FeatureFlags {
  // Модуль разборок
  enablePartsModule: boolean
  enablePartsInventory: boolean
  enablePartsOrders: boolean
  enablePartsEmployees: boolean
  enablePartsAnalytics: boolean
  
  // Новая аналитика
  enableAdvancedAnalytics: boolean
  
  // Функции в разработке
  enableDarkMode: boolean
  enableNotifications: boolean
  enableExport: boolean
  
  // Административные функции
  enableUserManagement: boolean
  enableRoleManagement: boolean
  enableSubscriptionManagement: boolean
}

/**
 * Дефолтные значения Feature Flags
 * В продакшене можно переопределить через env-переменные
 */
const defaultFlags: FeatureFlags = {
  // Модуль разборок (в разработке - выключен)
  enablePartsModule: false,
  enablePartsInventory: false,
  enablePartsOrders: false,
  enablePartsEmployees: false,
  enablePartsAnalytics: false,
  
  // Новая аналитика
  enableAdvancedAnalytics: true,
  
  // Функции в разработке
  enableDarkMode: false,
  enableNotifications: false,
  enableExport: false,
  
  // Административные функции (включены)
  enableUserManagement: true,
  enableRoleManagement: true,
  enableSubscriptionManagement: true
}

/**
 * Получение значения флага из переменных окружения
 */
function getEnvFlag(key: string, defaultValue: boolean): boolean {
  const envKey = `VITE_FEATURE_${key.toUpperCase()}`
  const envValue = import.meta.env[envKey]
  
  if (envValue === undefined) return defaultValue
  return envValue === 'true' || envValue === '1'
}

/**
 * Инициализация флагов с учетом env-переменных
 */
function initializeFlags(): FeatureFlags {
  return Object.keys(defaultFlags).reduce((acc, key) => {
    acc[key as keyof FeatureFlags] = getEnvFlag(
      key,
      defaultFlags[key as keyof FeatureFlags]
    )
    return acc
  }, {} as FeatureFlags)
}

// Экспорт активных флагов
export const featureFlags = initializeFlags()

/**
 * Хук для проверки флага в компонентах
 * @example
 * ```tsx
 * const isEnabled = useFeatureFlag('enablePartsModule')
 * if (!isEnabled) return null
 * ```
 */
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag]
}

/**
 * Компонент для условного рендеринга по флагу
 * @example
 * ```tsx
 * <FeatureFlag flag="enablePartsModule">
 *   <PartsModule />
 * </FeatureFlag>
 * ```
 */
export function FeatureFlag({
  flag,
  children,
  fallback = null
}: {
  flag: keyof FeatureFlags
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return featureFlags[flag] ? <>{children}</> : <>{fallback}</>
}
