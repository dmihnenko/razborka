import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, UserPlus, User, X } from 'lucide-react'
import { getPartsCustomersDropdown } from '@/services/partsService'
import { filterCustomers, type CustomerChoice } from './saleLogic'

interface CustomerPickerProps {
  partsCompanyId: string
  value: CustomerChoice
  onChange: (next: CustomerChoice) => void
}

/**
 * Выбор клиента: поиск существующего по имени/телефону, «без клиента» или быстрое
 * создание нового (имя + телефон; запись создаётся при оформлении продажи).
 */
export function CustomerPicker({ partsCompanyId, value, onChange }: CustomerPickerProps) {
  const { t } = useTranslation('cabinet')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['parts-customers-dropdown', partsCompanyId],
    queryFn: () => getPartsCustomersDropdown(partsCompanyId),
    enabled: !!partsCompanyId,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const choose = (next: CustomerChoice) => {
    onChange(next)
    setOpen(false)
    setSearch('')
  }

  if (value.kind === 'new') {
    return (
      <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">{t('inventoryPage.newCustomer')}</span>
          <button
            type="button"
            onClick={() => choose({ kind: 'none' })}
            className="btn-icon-sm"
            aria-label={t('inventoryPage.cancel')}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={t('saleSheet.customerNamePlaceholder', { defaultValue: 'Имя клиента' })}
          className="form-input"
          autoFocus
        />
        <input
          type="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder={t('saleSheet.customerPhonePlaceholder', { defaultValue: 'Телефон' })}
          className="form-input"
        />
      </div>
    )
  }

  if (value.kind === 'existing') {
    const c = customers.find((x) => x.id === value.id)
    return (
      <div className="flex items-center justify-between gap-2 form-input">
        <span className="inline-flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
          <span className="truncate">
            {c?.full_name ?? '…'}
            {c?.phone && <span className="text-gray-400"> · {c.phone}</span>}
          </span>
        </span>
        <button
          type="button"
          onClick={() => choose({ kind: 'none' })}
          className="text-gray-400 hover:text-red-500 flex-shrink-0"
          aria-label={t('createOrderPage.resetCustomer')}
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  const filtered = filterCustomers(customers, search)

  return (
    <div className="flex gap-2">
      <div className="relative flex-1" ref={wrapRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={isLoading ? t('createOrderPage.loadingCustomers') : t('createOrderPage.searchPlaceholder')}
          className="form-input pl-9"
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => choose({ kind: 'none' })}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-500"
            >
              {t('createOrderPage.noCustomer')}
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choose({ kind: 'existing', id: c.id })}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-t border-gray-50"
              >
                <span className="block text-sm font-medium text-gray-900 truncate">{c.full_name}</span>
                {c.phone && <span className="block text-xs text-gray-400 truncate">{c.phone}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-gray-400">{t('createOrderPage.customerNotFound')}</p>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange({ kind: 'new', name: search.trim(), phone: '' })}
        className="cab-btn cab-btn-secondary px-3 flex-shrink-0"
        title={t('inventoryPage.newCustomer')}
        aria-label={t('inventoryPage.newCustomer')}
      >
        <UserPlus className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </div>
  )
}
