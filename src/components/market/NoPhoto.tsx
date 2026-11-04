import { CameraOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface NoPhotoProps {
  /** card — плитка каталога; page — большая страница товара; thumb — маленькая иконка без подписи */
  size?: 'card' | 'page' | 'thumb'
}

const ICON = { card: 'w-9 h-9', page: 'w-14 h-14', thumb: 'w-6 h-6' } as const

/** Заглушка «Тихая»: приглушённая иконка и мелкая подпись на фоне --mk-surface-2. */
export default function NoPhoto({ size = 'card' }: NoPhotoProps) {
  const { t } = useTranslation('market')
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1.5"
      style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-3)' }}
    >
      <CameraOff className={ICON[size]} strokeWidth={1.25} aria-hidden="true" />
      {size !== 'thumb' && <span className={size === 'page' ? 'text-xs' : 'text-[11px]'}>{t('card.noPhoto')}</span>}
    </div>
  )
}
