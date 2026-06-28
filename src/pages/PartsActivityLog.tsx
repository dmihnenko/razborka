import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, Tag, History, User } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'
import { getActivityLog } from '@/services/activityLogService'
import type { ActivityLogEntry } from '@/services/activityLogService'
import { formatDateTime } from '@/utils/date'

// ─── Вспомогательные функции ───────────────────────────────────────────────

function entityTypeLabel(type: string): string {
  if (type === 'order') return i18n.t('cabinet:activityPage.entityOrder')
  if (type === 'inventory') return i18n.t('cabinet:activityPage.entityInventory')
  return type
}

interface ActionIconProps {
  action: string
}

function ActionIcon({ action }: ActionIconProps) {
  if (action === 'status_change') {
    return (
      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex-shrink-0">
        <ArrowRightLeft className="w-4 h-4" />
      </span>
    )
  }
  if (action === 'price_change') {
    return (
      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex-shrink-0">
        <Tag className="w-4 h-4" />
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
      <History className="w-4 h-4" />
    </span>
  )
}

function actionLabel(action: string): string {
  if (action === 'status_change') return i18n.t('cabinet:activityPage.actionStatusChange')
  if (action === 'price_change') return i18n.t('cabinet:activityPage.actionPriceChange')
  return action
}

// ─── Карточка записи ──────────────────────────────────────────────────────

function LogItem({ entry }: { entry: ActivityLogEntry }) {
  return (
    <div className="flex items-start gap-3 py-3 px-4 border-b border-gray-100 last:border-b-0">
      <ActionIcon action={entry.action} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 uppercase tracking-wide">
            {entityTypeLabel(entry.entity_type)}
          </span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-500">{actionLabel(entry.action)}</span>
        </div>
        {entry.entity_label && (
          <p className="font-semibold text-gray-900 text-sm mt-0.5 truncate">
            {entry.entity_label}
          </p>
        )}
        {entry.detail && (
          <p className="text-sm text-gray-600 mt-0.5 leading-snug">{entry.detail}</p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <User className="w-3 h-3" />
            {entry.user_name ?? '—'}
          </span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Страница ────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function PartsActivityLog() {
  const { t } = useTranslation('cabinet')
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const isOwner = profile?.roles?.some((r: any) => r.name === 'parts_owner')

  const [page, setPage] = useState(0)

  // Все уже загруженные записи, накопленные постранично
  const [allItems, setAllItems] = useState<ActivityLogEntry[]>([])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['parts-activity-log', partsCompanyId, page],
    staleTime: 1000 * 60 * 2,
    enabled: !!partsCompanyId && !!isOwner,
    queryFn: async () => {
      if (!partsCompanyId) return { items: [], total: 0 }
      const result = await getActivityLog(partsCompanyId, { page, pageSize: PAGE_SIZE })
      if (page === 0) {
        setAllItems(result.items)
      } else {
        setAllItems(prev => {
          // Не дублируем уже имеющиеся
          const existingIds = new Set(prev.map(i => i.id))
          const newOnes = result.items.filter(i => !existingIds.has(i.id))
          return [...prev, ...newOnes]
        })
      }
      return result
    },
  })

  if (!isOwner) return <PartsAccessDenied />

  const total = data?.total ?? 0
  const hasMore = allItems.length < total

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader title={i18n.t('cabinet:pages.activity')} backPath="/parts/dashboard" />

      <div className="px-4 sm:px-6 py-6">
        {/* Счётчик */}
        {total > 0 && (
          <p className="text-sm text-gray-500 mb-4">
            {t('activityPage.shownPrefix')}{' '}
            <span className="font-medium text-gray-700">{allItems.length}</span>{' '}
            {t('activityPage.shownOf')}{' '}
            <span className="font-medium text-gray-700">{total}</span>{' '}
            {t('activityPage.shownSuffix')}
          </p>
        )}

        {/* Список */}
        {isLoading && page === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner size="sm" />
          </div>
        ) : allItems.length === 0 ? (
          <div className="cab-card p-4 text-center py-16">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('activityPage.empty')}</p>
            <p className="text-sm text-gray-400 mt-1">
              {t('activityPage.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="cab-card overflow-hidden p-0">
            {allItems.map(entry => (
              <LogItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* Кнопка «Загрузить ещё» */}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              className="cab-btn cab-btn-secondary"
              disabled={isFetching}
              onClick={() => setPage(p => p + 1)}
            >
              {isFetching ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  {t('activityPage.loading')}
                </span>
              ) : (
                t('activityPage.loadMore', { n: total - allItems.length })
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
