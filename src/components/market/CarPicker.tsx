import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { getMarketCarCatalog } from '@/services/marketplaceService'
import { slugify } from '@/utils/slug'

// ============================================================================
// Подбор по авто: одна строка «Марка, Модель, Год, Показать». Данные — только из
// справочника getMarketCarCatalog, опции без деталей не показываем. Переход в
// каталог: марка/модель — SEO-маршрутом /market/catalog/:make/:model, с годом — query.
// ============================================================================

export function CarPicker() {
  const { t } = useTranslation('market')
  const navigate = useNavigate()
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['market-car-catalog'], queryFn: getMarketCarCatalog, staleTime: 5 * 60_000,
  })
  const [pickedMake, setPickedMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')

  if (isLoading) {
    return <div className="mk-card h-24" aria-hidden="true" />
  }
  const makes = raw.filter(m => (m.count ?? 0) > 0)
  if (makes.length === 0) return null

  // Если марка одна — выбрана сразу, и на телефоне её поле не занимает место
  const singleMake = makes.length === 1
  const make = singleMake ? makes[0].make : pickedMake
  const makeFacet = makes.find(m => m.make === make)
  const models = (makeFacet?.models ?? []).filter(m => (m.count ?? 0) > 0)
  const modelFacet = models.find(m => m.model === model)
  const years = [...(modelFacet?.years ?? [])].sort((a, b) => b - a)

  // Год выбран: берём year_counts[год]; если данных по году нет — кнопка без числа
  const yearCount = year ? modelFacet?.year_counts?.[year] : undefined
  const count = year
    ? (yearCount && yearCount > 0 ? yearCount : null)
    : modelFacet?.count ?? makeFacet?.count ?? makes.reduce((s, m) => s + (m.count ?? 0), 0)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (make && model && year) {
      navigate(`/market/catalog?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`)
    } else if (make) {
      navigate(`/market/catalog/${slugify(make)}${model ? `/${slugify(model)}` : ''}`)
    } else {
      navigate('/market/catalog')
    }
  }

  return (
    <section className="mk-card p-3 sm:p-4" aria-labelledby="mk-picker-title">
      <h2 id="mk-picker-title" className="mk-title mb-2.5">{t('picker.title')}</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:gap-3 items-end">
        <div className={singleMake ? 'hidden sm:block' : 'col-span-2 sm:col-span-1'}>
          <label htmlFor="mk-picker-make" className="block text-xs mk-meta mb-1">{t('picker.make')}</label>
          <select
            id="mk-picker-make" className="mk-input" value={make} disabled={singleMake}
            onChange={e => { setPickedMake(e.target.value); setModel(''); setYear('') }}
          >
            {!singleMake && <option value="">{t('picker.allMakes')}</option>}
            {makes.map(m => <option key={m.make} value={m.make}>{m.make} ({m.count})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mk-picker-model" className="block text-xs mk-meta mb-1">
            {t('picker.model')}{singleMake && <span className="sm:hidden"> {make}</span>}
          </label>
          <select
            id="mk-picker-model" className="mk-input" value={model} disabled={!make}
            onChange={e => { setModel(e.target.value); setYear('') }}
          >
            <option value="">{t('picker.allModels')}</option>
            {models.map(m => <option key={m.model} value={m.model}>{m.model} ({m.count})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mk-picker-year" className="block text-xs mk-meta mb-1">{t('picker.year')}</label>
          <select
            id="mk-picker-year" className="mk-input" value={year} disabled={years.length === 0}
            onChange={e => setYear(e.target.value)}
          >
            <option value="">{t('picker.allYears')}</option>
            {years.map(y => {
              const yc = modelFacet?.year_counts?.[String(y)]
              return <option key={y} value={y}>{yc && yc > 0 ? `${y} (${yc})` : y}</option>
            })}
          </select>
        </div>
        <button type="submit" className="mk-btn mk-btn-accent col-span-2 sm:col-span-1 whitespace-nowrap">
          <Search className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          {count === null ? t('picker.showParts') : t('picker.showCount', { count })}
        </button>
      </form>
    </section>
  )
}

export default CarPicker
