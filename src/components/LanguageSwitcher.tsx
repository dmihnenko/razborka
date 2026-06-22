import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { SUPPORTED_LANGS } from '@/i18n'

/**
 * Переключатель языка (RU/UK). Стиль нейтральный (mk-/cab-токены с фолбэками) —
 * подходит и для маркета, и для кабинета, и для логина.
 */
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage()
  const { t } = useTranslation('common')
  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      className={`inline-flex items-center rounded-lg p-0.5 ${className}`}
      style={{ background: 'var(--mk-surface-2, #F4F5F7)', border: '1px solid var(--mk-border, #E4E6EA)' }}
    >
      {SUPPORTED_LANGS.map((l) => {
        const active = lang === l
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            className="px-2.5 h-7 rounded-md text-xs font-bold transition-colors"
            style={active
              ? { background: 'var(--mk-surface, #fff)', color: 'var(--mk-text, #16181D)', boxShadow: '0 1px 2px rgba(20,20,40,.08)' }
              : { color: 'var(--mk-text-3, #8B909A)' }}
          >
            {t(`lang.${l}`)}
          </button>
        )
      })}
    </div>
  )
}
