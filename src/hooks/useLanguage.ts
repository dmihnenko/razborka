import { useTranslation } from 'react-i18next'
import { useAuth } from './useAuth'
import { updateUserLocale } from '@/services/userService'
import { normalizeLang, LANG_STORAGE_KEY, type Lang } from '@/i18n'

/**
 * Текущий язык интерфейса и его смена. При смене:
 * - меняем язык i18next + пишем в localStorage 'tsp_lang' (мгновенно, для анонима),
 * - если есть сессия — сохраняем в БД (user_profiles.locale), чтобы выбор переживал устройства.
 */
export function useLanguage() {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const lang = normalizeLang(i18n.language)

  const setLang = (l: Lang) => {
    if (l === lang) return
    i18n.changeLanguage(l)
    try { localStorage.setItem(LANG_STORAGE_KEY, l) } catch { /* ignore */ }
    if (user) updateUserLocale(user.id, l).catch(() => { /* БД-сохранение не критично */ })
  }

  return { lang, setLang }
}
