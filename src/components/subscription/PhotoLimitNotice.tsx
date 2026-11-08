import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { getMyPhotoUsage } from '@/services/photoStorageConfig'

/** Доля лимита, с которой предупреждаем заранее */
const WARN_AT = 0.9

/**
 * Подсказка о лимите фото по тарифу: с 90% — предупреждение, на 100% — «исчерпан».
 * Объясняет, почему лимит есть (место под фото оплачивается ежемесячно), и ведёт к смене тарифа.
 */
export default function PhotoLimitNotice({ companyId }: { companyId: string | null | undefined }) {
  const { t } = useTranslation('cabinet')
  const { data: usage } = useQuery({
    queryKey: ['photo-usage', companyId],
    queryFn: getMyPhotoUsage,
    enabled: !!companyId,
    refetchOnMount: 'always',
  })
  if (!usage || usage.limit_photos == null || usage.limit_photos <= 0) return null
  const { used_photos: used, limit_photos: limit } = usage
  if (used < limit * WARN_AT) return null
  const full = used >= limit
  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="cab-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="relative mt-0.5 flex-shrink-0 text-gray-500">
          <Camera className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${full ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {full
              ? t('photoLimit.fullTitle', { used: fmt(used), limit: fmt(limit) })
              : t('photoLimit.warnTitle', { used: fmt(used), limit: fmt(limit) })}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t('photoLimit.why')}</p>
        </div>
      </div>
      <Link to="/parts/subscription" className="cab-btn cab-btn-secondary cab-btn-sm flex-shrink-0 self-start sm:self-center">
        {t('photoLimit.cta')}
      </Link>
    </div>
  )
}
