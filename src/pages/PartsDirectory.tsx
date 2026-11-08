import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Содержимое вкладок — существующие страницы, встроенные как компоненты.
const PartsWarehouse = lazy(() => import('./PartsWarehouse'))
const PartsCategories = lazy(() => import('./PartsCategories'))

type Section = 'locations' | 'categories'
const SECTIONS: Section[] = ['locations', 'categories']

/**
 * «Справочники»: места хранения + категории. Вкладка хаба — параметр ?section=,
 * чтобы не пересекаться с ?tab=templates самой страницы категорий.
 */
export default function PartsDirectory() {
  const { t } = useTranslation('cabinet')
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('section')
  const section: Section = SECTIONS.includes(param as Section) ? (param as Section) : 'locations'

  const labels: Record<Section, string> = {
    locations: t('directory.tabLocations', { defaultValue: 'Места хранения' }),
    categories: t('directory.tabCategories', { defaultValue: 'Категории' }),
  }

  return (
    <div className="min-w-0">
      <h1 className="page-title truncate mb-3">{t('directory.title', { defaultValue: 'Справочники' })}</h1>

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
        {section === 'locations' && <PartsWarehouse embedded />}
        {section === 'categories' && <PartsCategories embedded />}
      </Suspense>
    </div>
  )
}
