import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ruCommon from './locales/ru/common.json'
import ruMarket from './locales/ru/market.json'
import ruAuth from './locales/ru/auth.json'
import ruCabinet from './locales/ru/cabinet.json'
import ruBusiness from './locales/ru/business.json'
import ukCommon from './locales/uk/common.json'
import ukMarket from './locales/uk/market.json'
import ukAuth from './locales/uk/auth.json'
import ukCabinet from './locales/uk/cabinet.json'
import ukBusiness from './locales/uk/business.json'

// Два языка интерфейса: русский (по умолчанию) и украинский.
export const SUPPORTED_LANGS = ['ru', 'uk'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]
export const LANG_STORAGE_KEY = 'tsp_lang'

export const resources = {
  ru: { common: ruCommon, market: ruMarket, auth: ruAuth, cabinet: ruCabinet, business: ruBusiness },
  uk: { common: ukCommon, market: ukMarket, auth: ukAuth, cabinet: ukCabinet, business: ukBusiness },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true, // uk-UA → uk
    ns: ['common', 'market', 'auth', 'cabinet', 'business'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
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
applyHtmlLang(i18n.language)
i18n.on('languageChanged', applyHtmlLang)

export default i18n
