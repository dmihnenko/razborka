import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'

// Содержимое вкладок — существующие страницы, встроенные как компоненты.
const PartsActivityLog = lazy(() => import('./PartsActivityLog'))
const Trash = lazy(() => import('./Trash'))

type Section = 'activity' | 'trash'

/**
 * «Журнал»: история + корзина. Корзина доступна всем ролям разборки, история — только
 * владельцу разборки и админу (как и раньше). Вкладка хаба — параметр ?section=.
 */
export default function PartsJournal() {
  const { t } = useTranslation('cabinet')
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: profile } = useUserProfile()
  const roles = profile?.roles?.map((r) => r.name) || []
  const canSeeHistory = roles.includes('parts_owner') || roles.includes('admin')
  const hasPartsAccess = canSeeHistory || roles.includes('parts_worker')

  const SECTIONS: Section[] = canSeeHistory ? ['activity', 'trash'] : ['trash']
  const param = searchParams.get('section')
  const section: Section = SECTIONS.includes(param as Section) ? (param as Section) : SECTIONS[0]

  if (!profile) return null
  if (!hasPartsAccess) return <PartsAccessDenied />

  const labels: Record<Section, string> = {
    activity: t('journal.tabActivity', { defaultValue: 'История' }),
    trash: t('journal.tabTrash', { defaultValue: 'Корзина' }),
  }

  return (
    <div className="min-w-0">
      <h1 className="page-title truncate mb-3">{t('journal.title', { defaultValue: 'Журнал' })}</h1>

      <div role="tablist" className="flex gap-2 mb-3 overflow-x-auto">
        {SECTIONS.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={section === key}
            onClick={() => setSearchParams({ section: key }, { replace: true })}
            className={`${section === key ? 'cab-chip cab-chip-signal' : 'cab-chip'} flex-shrink-0`}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      <Suspense fallback={null}>
        {section === 'activity' && <PartsActivityLog embedded />}
        {section === 'trash' && <Trash embedded />}
      </Suspense>
    </div>
  )
}
