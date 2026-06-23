import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { SUPPORTED_LANGS } from '@/i18n'

/**
 * Переключатель языка — единая кнопка-свитч (а не два языка сразу).
 * Показывает текущий язык; клик переключает на следующий по кругу
 * (RU → UK → RU). Высота берётся из --mk-control-h, чтобы совпадать
 * с соседними контролами; токены с фолбэками — годится и для маркета,
 * и для кабинета, и для логина.
 */
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage()
  const { t } = useTranslation('common')
  const idx = SUPPORTED_LANGS.indexOf(lang)
  const next = SUPPORTED_LANGS[(idx + 1) % SUPPORTED_LANGS.length]
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={t('lang.switchTo', {
        lang: t(`lang.${next}`),
        defaultValue: `Switch language to ${next.toUpperCase()}`,
      })}
      title={t('lang.label')}
      className={`inline-flex items-center justify-center rounded-lg px-2 sm:px-2.5 text-xs font-bold uppercase transition-colors flex-shrink-0 ${className}`}
      style={{
        height: 'var(--mk-control-h, 36px)',
        background: 'var(--mk-surface, #fff)',
        border: '1px solid var(--mk-border, #E4E6EA)',
        color: 'var(--mk-text, #16181D)',
      }}
    >
      {t(`lang.${lang}`)}
    </button>
  )
}
