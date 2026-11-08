import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Search, X } from 'lucide-react'
import { searchSaleStock } from '@/services/partsService'
import { formatPrice } from '@/utils/currency'
import { clampQty, type SaleLine } from './saleLogic'

interface SaleItemsProps {
  partsCompanyId: string
  lines: SaleLine[]
  onChange: (next: SaleLine[]) => void
}

type StockRow = {
  id: string
  name: string
  part_number?: string | null
  quantity: number
  reserved_quantity?: number | null
  selling_price?: number | null
  price_currency?: 'UAH' | 'USD' | null
}

/** Список позиций продажи + поиск по складу для добавления. */
export function SaleItems({ partsCompanyId, lines, onChange }: SaleItemsProps) {
  const { t } = useTranslation('cabinet')
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')

  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(id)
  }, [query])

  const { data: stock = [] } = useQuery({
    queryKey: ['parts-inventory-for-order', partsCompanyId, 'search', debounced],
    queryFn: () => searchSaleStock(partsCompanyId, debounced, 20) as Promise<StockRow[]>,
    enabled: !!partsCompanyId && adding,
    staleTime: 30_000, // инвалидируется после продажи
  })

  const patch = (idx: number, p: Partial<SaleLine>) =>
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...p } : l)))

  const results = useMemo(() => {
    const taken = new Set(lines.map((l) => l.itemId))
    return stock
      .map((r) => ({ ...r, free: (r.quantity ?? 0) - (r.reserved_quantity ?? 0) }))
      .filter((r) => r.free > 0 && !taken.has(r.id))
  }, [stock, lines])

  const addRow = (r: StockRow & { free: number }) => {
    onChange([
      ...lines,
      {
        itemId: r.id,
        name: r.name,
        partNumber: r.part_number,
        maxQty: r.free,
        quantity: 1,
        price: r.selling_price ? String(r.selling_price) : '',
        currency: r.price_currency || 'USD',
        announcedPrice: r.selling_price,
        listCurrency: r.price_currency || 'USD',
      },
    ])
    setAdding(false)
    setQuery('')
  }

  return (
    <div className="space-y-2">
      {lines.length === 0 && (
        <p className="text-sm text-gray-400 py-1">{t('saleSheet.noItems', { defaultValue: 'Позиции не выбраны' })}</p>
      )}

      {lines.map((l, idx) => (
        <div key={l.itemId} className="p-2.5 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {l.partNumber && <span>{l.partNumber} · </span>}
                {t('inventoryPage.inStock', { n: l.maxQty })}
                {l.announcedPrice ? <span> · {t('inventoryPage.announcedPrice')}: {formatPrice(l.announcedPrice, l.listCurrency ?? l.currency)}</span> : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange(lines.filter((_, i) => i !== idx))}
              className="btn-icon-sm flex-shrink-0"
              aria-label={t('inventoryPage.delete')}
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {l.maxQty > 1 && (
              <label className="flex items-center gap-1 text-xs text-gray-500">
                {t('inventoryPage.qtyShort')}
                <input
                  type="number"
                  min={1}
                  max={l.maxQty}
                  step={1}
                  value={l.quantity}
                  onChange={(e) => patch(idx, { quantity: clampQty(parseInt(e.target.value, 10), l.maxQty) })}
                  className="form-input w-16 text-center px-2 py-1.5 text-sm tabular-nums"
                />
              </label>
            )}
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={l.price}
              onChange={(e) => patch(idx, { price: e.target.value })}
              placeholder={t('inventoryPage.pricePlaceholder')}
              aria-label={t('inventoryPage.pricePlaceholder')}
              className="form-input flex-1 min-w-0 px-2 py-1.5 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={() => patch(idx, { currency: l.currency === 'USD' ? 'UAH' : 'USD' })}
              className="cab-btn cab-btn-primary cab-btn-sm w-11 text-center px-0 tabular-nums"
            >
              {l.currency === 'USD' ? '$' : t('vehicleDetailsPage.uah')}
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('orderDetailsPage.searchPartPlaceholder')}
              className="form-input pl-9 border-0 border-b border-gray-100 rounded-b-none"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {results.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                {debounced ? t('orderDetailsPage.partsNotFound') : t('saleSheet.startTyping')}
              </p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addRow(r)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-t border-gray-50 first:border-t-0"
                >
                  <span className="block text-sm font-medium text-gray-900 truncate">{r.name}</span>
                  <span className="block text-xs text-gray-400 truncate">
                    {r.part_number && <span>{r.part_number} · </span>}
                    {t('inventoryPage.inStock', { n: r.free })}
                    {r.selling_price ? ` · ${formatPrice(r.selling_price, r.price_currency || 'USD')}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => { setAdding(false); setQuery('') }}
            className="w-full px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100"
          >
            {t('inventoryPage.cancel')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="cab-btn cab-btn-secondary cab-btn-sm">
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          {t('saleSheet.addItem', { defaultValue: 'Добавить позицию' })}
        </button>
      )}
    </div>
  )
}
