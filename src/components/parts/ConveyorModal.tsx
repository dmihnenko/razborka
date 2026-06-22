/**
 * Модалка «Конвейер» — быстрый последовательный ввод запчастей к выбранному авто.
 * Оприходование свежеразобранной машины без открытия полной формы после каждой запчасти.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronDown, Zap, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPartsInventoryItem } from '@/services/partsService'
import type { CreatePartsInventoryInput, PartsInventoryStatus } from '@/types/parts'
import { formatPrice } from '@/utils/currency'

interface Vehicle {
  id: string
  make: string
  model: string
  year?: number
}

interface Category {
  id: string
  name: string
  brand?: string
}

interface RecentItem {
  id: string
  name: string
  selling_price?: number
  price_currency: 'UAH' | 'USD'
}

interface ConveyorModalProps {
  partsCompanyId: string
  vehicles: Vehicle[]
  categories: Category[]
  onClose: () => void
  initialVehicleId?: string
}

interface ConveyorForm {
  name: string
  category_id: string
  selling_price: string
  price_currency: 'UAH' | 'USD'
  condition: string
  quantity: string
}

const EMPTY_FORM: ConveyorForm = {
  name: '',
  category_id: '',
  selling_price: '',
  price_currency: 'USD',
  condition: 'used',
  quantity: '1',
}

export function ConveyorModal({ partsCompanyId, vehicles, categories, onClose, initialVehicleId }: ConveyorModalProps) {
  const { t } = useTranslation('cabinet')
  const queryClient = useQueryClient()
  const nameRef = useRef<HTMLInputElement>(null)

  const [vehicleId, setVehicleId] = useState<string>(initialVehicleId ?? vehicles[0]?.id ?? '')
  const [form, setForm] = useState<ConveyorForm>(EMPTY_FORM)
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [addedCount, setAddedCount] = useState(0)

  // Фокус в поле «Название» при открытии
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  // Фильтруем категории по выбранному авто (марке)
  const filteredCategories = (() => {
    if (!vehicleId) return categories
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return categories
    const make = vehicle.make.toLowerCase()
    const relevant = categories.filter(c => !c.brand || c.brand.toLowerCase() === make)
    return relevant.length > 0 ? relevant : categories
  })()

  const addMutation = useMutation({
    mutationFn: (input: CreatePartsInventoryInput) =>
      createPartsInventoryItem(input, partsCompanyId),
    onSuccess: (item) => {
      const priceNum = parseFloat(form.selling_price) || undefined
      setRecentItems(prev => [
        { id: item.id, name: item.name, selling_price: priceNum, price_currency: form.price_currency },
        ...prev,
      ].slice(0, 5))
      setAddedCount(c => c + 1)
      // Сбрасываем только название, категорию — сохраняем валюту, состояние
      setForm(prev => ({
        ...EMPTY_FORM,
        price_currency: prev.price_currency,
        condition: prev.condition,
        category_id: prev.category_id,
        quantity: '1',
      }))
      // Возвращаем фокус в «Название»
      setTimeout(() => nameRef.current?.focus(), 40)
    },
    onError: () => toast.error(t('conveyorModal.toastError')),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      nameRef.current?.focus()
      return
    }
    const price = parseFloat(form.selling_price)
    addMutation.mutate({
      name: form.name.trim(),
      category_id: form.category_id || undefined,
      vehicle_id: vehicleId || undefined,
      condition: form.condition,
      quantity: Math.max(1, parseInt(form.quantity) || 1),
      selling_price: isNaN(price) ? undefined : price,
      price_currency: form.price_currency,
      status: 'available' as PartsInventoryStatus,
    })
  }

  const handleDone = () => {
    if (addedCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
    }
    onClose()
  }

  // Закрытие по Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDone()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })  

  return (
    <div className="modal-overlay">
      <div className="absolute inset-0" />
      <div className="modal-sheet sm:max-w-lg w-full z-10 overflow-y-auto max-h-[95dvh]">
        <div className="modal-handle sm:hidden" />

        {/* Шапка */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" strokeWidth={1.5} />
            <h3 className="text-base font-bold text-gray-900">{t('conveyorModal.title')}</h3>
            {addedCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                +{addedCount}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('conveyorModal.subtitle')}
          </p>
        </div>

        <div className="modal-body space-y-4">
          {/* Выбор авто (фиксируется сверху) */}
          <div>
            <label className="form-label">{t('conveyorModal.vehicle')}</label>
            <div className="relative">
              <select
                value={vehicleId}
                onChange={e => {
                  setVehicleId(e.target.value)
                  setForm(prev => ({ ...prev, category_id: '' }))
                }}
                className="form-select"
              >
                <option value="">{t('conveyorModal.noVehicle')}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
            </div>
          </div>

          {/* Форма запчасти */}
          <form onSubmit={handleAdd} className="space-y-3">
            {/* Название */}
            <div>
              <label className="form-label">
                {t('conveyorModal.name')} <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('conveyorModal.namePlaceholder')}
                className="form-input"
                autoComplete="off"
              />
            </div>

            {/* Категория */}
            <div>
              <label className="form-label">{t('conveyorModal.category')}</label>
              <div className="relative">
                <select
                  value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="form-select"
                >
                  <option value="">{t('conveyorModal.noCategory')}</option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
              </div>
            </div>

            {/* Цена + валюта */}
            <div>
              <label className="form-label">{t('conveyorModal.sellingPrice')}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
                  placeholder="0"
                  className="form-input flex-1"
                />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, price_currency: f.price_currency === 'USD' ? 'UAH' : 'USD' }))}
                  className="cab-btn cab-btn-primary w-12 text-center px-0 flex-shrink-0"
                  title={t('conveyorModal.toggleCurrency')}
                >
                  {form.price_currency === 'USD' ? '$' : t('conveyorModal.currencyUah')}
                </button>
              </div>
            </div>

            {/* Состояние + Кол-во */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t('conveyorModal.condition')}</label>
                <div className="relative">
                  <select
                    value={form.condition}
                    onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                    className="form-select"
                  >
                    <option value="new">{t('conveyorModal.conditionNew')}</option>
                    <option value="used">{t('conveyorModal.conditionUsed')}</option>
                    <option value="damaged">{t('conveyorModal.conditionDamaged')}</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <label className="form-label">{t('conveyorModal.quantity')}</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>

            {/* Кнопка «Добавить и продолжить» */}
            <button
              type="submit"
              disabled={addMutation.isPending || !form.name.trim()}
              className="cab-btn cab-btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-50"
            >
              {addMutation.isPending ? (
                <span>{t('conveyorModal.saving')}</span>
              ) : (
                <>
                  <span>{t('conveyorModal.addAndContinue')}</span>
                  <span className="text-xs opacity-70 font-normal">Enter</span>
                </>
              )}
            </button>
          </form>

          {/* Счётчик + последние 5 добавленных */}
          {recentItems.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-gray-700">
                  {t('conveyorModal.added')} <span className="text-green-600">{addedCount}</span>
                </span>
              </div>
              <div className="space-y-1.5">
                {recentItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-sm animate-fade-in"
                  >
                    <span className="font-medium text-gray-800 truncate">{item.name}</span>
                    {item.selling_price != null && (
                      <span className="text-green-700 font-semibold flex-shrink-0 text-xs">
                        {formatPrice(item.selling_price, item.price_currency)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Футер — кнопка выхода из режима «Конвейер» */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={handleDone}
            className="cab-btn cab-btn-secondary w-full flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
            {t('conveyorModal.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
