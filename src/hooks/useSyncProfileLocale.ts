import { useEffect } from 'react'
import i18n, { normalizeLang, LANG_STORAGE_KEY } from '@/i18n'
import { useUserProfile } from './useUserProfile'

/**
 * Для залогиненного пользователя язык из БД (user_profiles.locale) — источник истины:
 * при загрузке профиля применяем его (и в localStorage), чтобы выбор синхронился
 * между устройствами/браузерами. Вызывать один раз на уровне приложения.
 */
export function useSyncProfileLocale() {
  const { data: profile } = useUserProfile()
  const dbLocale: string | undefined = profile?.locale ?? undefined

  useEffect(() => {
    if (!dbLocale) return
    const norm = normalizeLang(dbLocale)
    if (norm !== normalizeLang(i18n.language)) {
      i18n.changeLanguage(norm)
      try { localStorage.setItem(LANG_STORAGE_KEY, norm) } catch { /* ignore */ }
    }
  }, [dbLocale])
}
