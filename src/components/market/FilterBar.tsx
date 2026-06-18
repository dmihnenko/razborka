import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import type { MarketCategory, MarketCondition, MarketFilters, MarketMakeFacet, MarketSort } from '@/types/marketplace'
import { PARTS_CONDITION_LABELS } from '@/utils/status'

// ============================================================================
// Панель фильтров каталога (Graphite). Управляемый компонент (value/onChange).
// Каскад по авто: Марка → Модель → Год (из справочника car_models).
// Достаточно выбрать марку и/или модель; год и категория — вспомогательные.
// ============================================================================

export interface FilterBarProps {
  value: MarketFilters
  onChange: (next: MarketFilters) => void
  categories?: MarketCategory[]
  carCatalog?: MarketMakeFacet[]
}

const SORT_OPTIONS: { value: MarketSort; label: string }[] = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'price_asc', label: 'Дешевле' },
  { value: 'price_desc', label: 'Дороже' },
]

const FIELD_LABEL = 'block text-xs font-semibold mb-1.5'

export function FilterBar({ value, onChange, categories = [], carCatalog = [] }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value.search ?? '')

  useEffect(() => { setSearch(value.search ?? '') }, [value.search])

  const patch = (p: Partial<MarketFilters>) => onChange({ ...value, ...p, page: 1 })

  const applyText = () => {
    patch({ search: search.trim() || undefined })
  }

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); applyText() }

  const reset = () => {
    setSearch('')
    onChange({ sort: value.sort, page: 1, pageSize: value.pageSize })
  }

  // ── Каскад: марка → модель → год ──────────────────────────────────────────
  const makeFacet = useMemo(() => carCatalog.find(m => m.make === value.make), [carCatalog, value.make])
  const models = makeFacet?.models ?? []
  const modelFacet = useMemo(() => models.find(m => m.model === value.model), [models, value.model])
  const years = modelFacet?.years ?? []

  const onMakeChange = (make: string) => patch({ make: make || undefined, model: undefined, year: undefined })
  const onModelChange = (model: string) => patch({ model: model || undefined, year: undefined })
  const onYearChange = (year: string) => patch({ year: year ? Number(year) : undefined })

  const activeCount = [value.search, value.categoryId, value.condition, value.make, value.model, value.year]
    .filter(v => v != null && v !== '').length

  return (
    <form onSubmit={handleSubmit} className="mk-card p-3.5 sm:p-4">
      {/* Поиск + кнопка «Фильтры» (мобила) */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onBlur={applyText}
            placeholder="Название, артикул, описание…"
            className="mk-input mk-search"
            aria-label="Поиск по каталогу"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); patch({ search: undefined }) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full inline-flex items-center justify-center mk-meta transition-colors hover:bg-[var(--mk-surface-2)]"
              aria-label="Очистить поиск"
            >
              <X className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="sm:hidden mk-btn mk-btn-outline relative flex-shrink-0"
          style={open || activeCount > 0 ? { borderColor: 'var(--mk-accent)', color: 'var(--mk-accent)' } : undefined}
          aria-expanded={open}
          aria-controls="mk-filter-panel"
        >
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          Фильтры
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: 'var(--mk-accent)', color: 'var(--mk-on-accent)' }}>
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Панель: на мобиле — по кнопке, на ≥sm — всегда */}
      <div id="mk-filter-panel" className={`${open ? 'block animate-fade-in' : 'hidden'} sm:block mt-3.5`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Марка */}
          {carCatalog.length > 0 && (
            <div>
              <label className={FIELD_LABEL} style={{ color: 'var(--mk-text-2)' }} htmlFor="mf-make">Марка</label>
              <select id="mf-make" value={value.make ?? ''} onChange={e => onMakeChange(e.target.value)} className="mk-input">
                <option value="">Все марки</option>
                {carCatalog.map(m => (
                  <option key={m.make} value={m.make}>{m.make}{m.count ? ` (${m.count})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Модель — только при выбранной марке */}
          {value.make && models.length > 0 && (
            <div>
              <label className={FIELD_LABEL} style={{ color: 'var(--mk-text-2)' }} htmlFor="mf-model">Модель</label>
              <select id="mf-model" value={value.model ?? ''} onChange={e => onModelChange(e.target.value)} className="mk-input">
                <option value="">Все модели</option>
                {models.map(m => (
                  <option key={m.model} value={m.model}>{m.model}{m.count ? ` (${m.count})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Год — только при выбранной модели с доступными годами */}
          {value.model && years.length > 0 && (
            <div>
              <label className={FIELD_LABEL} style={{ color: 'var(--mk-text-2)' }} htmlFor="mf-year">Год</label>
              <select id="mf-year" value={value.year ?? ''} onChange={e => onYearChange(e.target.value)} className="mk-input">
                <option value="">Любой год</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Категория */}
          {categories.length > 0 && (
            <div>
              <label className={FIELD_LABEL} style={{ color: 'var(--mk-text-2)' }} htmlFor="mf-category">Категория</label>
              <select id="mf-category" value={value.categoryId ?? ''} onChange={e => patch({ categoryId: e.target.value || undefined })} className="mk-input">
                <option value="">Все категории</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
              </select>
            </div>
          )}

          {/* Состояние */}
          <div>
            <label className={FIELD_LABEL} style={{ color: 'var(--mk-text-2)' }} htmlFor="mf-condition">Состояние</label>
            <select id="mf-condition" value={value.condition ?? ''} onChange={e => patch({ condition: (e.target.value || undefined) as MarketCondition | undefined })} className="mk-input">
              <option value="">Любое</option>
              {(['new', 'used', 'damaged'] as const).map(c => <option key={c} value={c}>{PARTS_CONDITION_LABELS[c]}</option>)}
            </select>
          </div>

          {/* Сортировка */}
          <div>
            <label className={FIELD_LABEL} style={{ color: 'var(--mk-text-2)' }} htmlFor="mf-sort">Сортировка</label>
            <select id="mf-sort" value={value.sort ?? 'new'} onChange={e => patch({ sort: e.target.value as MarketSort })} className="mk-input">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {activeCount > 0 && (
          <button type="button" onClick={reset} className="mt-3 inline-flex items-center gap-1.5 px-2.5 h-9 -mx-2.5 rounded-lg text-xs font-semibold mk-meta transition-colors hover:text-[var(--mk-text)] hover:bg-[var(--mk-surface-2)]">
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
            Сбросить фильтры ({activeCount})
          </button>
        )}
      </div>

      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
    </form>
  )
}

export default FilterBar
