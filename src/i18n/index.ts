import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import type { BackendModule } from 'i18next'

// Два языка интерфейса: русский (по умолчанию) и украинский.
export const SUPPORTED_LANGS = ['ru', 'uk'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]
export const LANG_STORAGE_KEY = 'tsp_lang'

// Словари грузятся лениво (отдельные чанки на язык+неймспейс), в entry их нет.
const loaders = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json')

const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = loaders[`./locales/${language}/${namespace}.json`]
    if (!load) {
      callback(new Error(`i18n: no resource ${language}/${namespace}`), null)
      return
    }
    load().then((m) => callback(null, m?.default ?? {})).catch((e) => callback(e, true))
  },
}

export const i18nReady = i18n
  .use(lazyBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ru',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true, // uk-UA → uk
    load: 'languageOnly', // uk-UA не запрашиваем, только uk
    maxRetries: 3,
    retryTimeout: 500,
    // На старте грузим только common; остальные неймспейсы подтягивает useTranslation(ns) (Suspense).
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      // querystring (?lng=uk) — первым: даёт рабочие языковые URL для SEO (hreflang) и
      // расшаривания ссылок. У залогиненных локаль из БД всё равно перекрывает (useSyncProfileLocale).
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

/** Нормализуем язык до 'ru' | 'uk'. */
export function normalizeLang(lng?: string | null): Lang {
  return lng?.toLowerCase().startsWith('uk') ? 'uk' : 'ru'
}

/** Локаль для Intl (даты/числа). */
export function intlLocale(lng = i18n.language): string {
  return normalizeLang(lng) === 'uk' ? 'uk-UA' : 'ru-RU'
}

// Синхронизируем <html lang> с текущим языком.
const applyHtmlLang = (lng: string) => {
  document.documentElement.lang = normalizeLang(lng)
}
applyHtmlLang(i18n.language || 'ru')
i18n.on('languageChanged', applyHtmlLang)

export default i18n
