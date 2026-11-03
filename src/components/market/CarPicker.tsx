import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronRight } from 'lucide-react'
import { getMarketCarCatalog } from '@/services/marketplaceService'
import { slugify } from '@/utils/slug'

// ============================================================================
// Подбор по авто: Марка → Модель → Год. Данные — только из справочника
// getMarketCarCatalog. Опции без деталей не показываем. Переход в каталог:
// марка/модель — SEO-маршрутом /market/catalog/:make/:model, с годом — query.
// ============================================================================

type Step = 0 | 1 | 2

export function CarPicker() {
  const { t } = useTranslation('market')
  const navigate = useNavigate()
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['market-car-catalog'], queryFn: getMarketCarCatalog, staleTime: 5 * 60_000,
  })

  const makes = useMemo(() => raw.filter(m => (m.count ?? 0) > 0), [raw])
  const [make, setMake] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [step, setStep] = useState<Step>(0)

  // Если марка одна — выбрана сразу
  useEffect(() => {
    if (makes.length === 1 && make === null) { setMake(makes[0].make); setStep(1) }
  }, [makes, make])

  const makeFacet = makes.find(m => m.make === make)
  const models = (makeFacet?.models ?? []).filter(m => (m.count ?? 0) > 0)
  const modelFacet = models.find(m => m.model === model)
  const years = [...(modelFacet?.years ?? [])].sort((a, b) => b - a)

  if (isLoading) {
    return <div className="mk-card h-40" aria-hidden="true" />
  }
  if (makes.length === 0) return null

  const goMake = (mk: string, md?: string) => {
    const base = `/market/catalog/${slugify(mk)}`
    navigate(md ? `${base}/${slugify(md)}` : base)
  }
  const goYear = (mk: string, md: string, y: number) => {
    navigate(`/market/catalog?make=${encodeURIComponent(mk)}&model=${encodeURIComponent(md)}&year=${y}`)
  }

  const steps: { label: string; value: string | null; enabled: boolean }[] = [
    { label: t('picker.stepMake'), value: make, enabled: true },
    { label: t('picker.stepModel'), value: model, enabled: make !== null },
    { label: t('picker.stepYear'), value: null, enabled: model !== null },
  ]
  const heading = step === 0 ? t('picker.chooseMake') : step === 1 ? t('picker.chooseModel') : t('picker.chooseYear')

  return (
    <section className="mk-card p-3 sm:p-4" aria-labelledby="mk-picker-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="mk-picker-title" className="mk-title">{t('picker.title')}</h2>
        {make && (
          <button
            type="button"
            className="mk-btn mk-btn-accent"
            onClick={() => goMake(make, model ?? undefined)}
          >
            {t('picker.showParts')}
          </button>
        )}
      </div>

      <ol className="mk-steps mb-3" aria-label={t('picker.nav')}>
        {steps.map((s, i) => (
          <li key={s.label} className="flex-1 min-w-0 flex">
            <button
              type="button"
              disabled={!s.enabled}
              onClick={() => setStep(i as Step)}
              aria-current={step === i ? 'step' : undefined}
              className={['mk-step w-full', i < step ? 'done' : ''].join(' ')}
            >
              <span className="mk-step-num" aria-hidden="true">
                {i < step ? <Check className="w-3 h-3" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="truncate">{s.value ?? s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <p className="text-xs mk-meta mb-2">{heading}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {step === 0 && makes.map(m => (
          <button key={m.make} type="button" className="mk-opt"
            onClick={() => { setMake(m.make); setModel(null); setStep(1) }}>
            <span className="truncate">{m.make}</span>
            <span className="mk-opt-count">{m.count}</span>
          </button>
        ))}
        {step === 1 && models.map(m => (
          <button key={m.model} type="button" className="mk-opt"
            onClick={() => { setModel(m.model); setStep(2) }}>
            <span className="truncate">{m.model}</span>
            <span className="mk-opt-count">{m.count}</span>
          </button>
        ))}
        {step === 2 && make && model && (
          <>
            <button type="button" className="mk-opt" onClick={() => goMake(make, model)}>
              <span className="truncate">{t('picker.allYears')}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 mk-meta" aria-hidden="true" />
            </button>
            {years.map(y => (
              <button key={y} type="button" className="mk-opt" onClick={() => goYear(make, model, y)}>
                <span>{y}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </section>
  )
}

export default CarPicker
