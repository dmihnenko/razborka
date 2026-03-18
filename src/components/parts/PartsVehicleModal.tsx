import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { IMaskInput } from 'react-imask'
import type { PartsVehicle, CreatePartsVehicleInput } from '@/types/parts'
import { formatCurrency } from '@/utils/currency'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'

interface PriceRow {
  id: number
  label: string
  amount: string
  currency: 'USD' | 'UAH'
}

let rowCounter = 1
function newRow(partial?: Partial<PriceRow>): PriceRow {
  return { id: rowCounter++, label: '', amount: '', currency: 'USD', ...partial }
}

function calcTotals(rows: PriceRow[], rate: number) {
  let totalUSD = 0
  let totalUAH = 0
  for (const row of rows) {
    const amt = parseFloat(row.amount) || 0
    if (row.currency === 'USD') {
      totalUSD += amt
      totalUAH += amt * rate
    } else {
      totalUAH += amt
      totalUSD += amt / rate
    }
  }
  return { totalUSD, totalUAH }
}

interface PartsVehicleModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreatePartsVehicleInput) => Promise<void>
  vehicle?: PartsVehicle | null
}

export default function PartsVehicleModal({ isOpen, onClose, onSubmit, vehicle }: PartsVehicleModalProps) {
  const { rate: globalRate } = usePartsExchangeRate()
  const [formData, setFormData] = useState<CreatePartsVehicleInput>({
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle?.year,
    vin: vehicle?.vin || '',
    color: vehicle?.color || '',
    mileage: vehicle?.mileage,
    notes: vehicle?.notes || ''
  })

  // Initialize price rows from existing vehicle data
  const [priceRows, setPriceRows] = useState<PriceRow[]>(() => {
    if (vehicle?.purchase_price && vehicle.purchase_price > 0) {
      const rate = vehicle.exchange_rate || globalRate || 41
      // stored as UAH — show as one USD row if divisible nicely, else UAH
      const asUSD = vehicle.purchase_price / rate
      const rounded = Math.round(asUSD)
      const isCleanUSD = Math.abs(rounded - asUSD) < 0.5
      return [newRow({ amount: isCleanUSD ? String(rounded) : String(vehicle.purchase_price), currency: isCleanUSD ? 'USD' : 'UAH' })]
    }
    return [newRow()]
  })

  const [exchangeRate, setExchangeRate] = useState<number>(vehicle?.exchange_rate || globalRate || 41)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { totalUSD, totalUAH } = calcTotals(priceRows, exchangeRate)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Убираем undefined значения перед отправкой
      const cleanData: CreatePartsVehicleInput = {
        make: formData.make,
        model: formData.model,
        ...(formData.year && { year: formData.year }),
        ...(formData.vin && { vin: formData.vin }),
        ...(formData.color && { color: formData.color }),
        ...(formData.mileage && { mileage: formData.mileage }),
        ...(totalUAH > 0 && { purchase_price: totalUAH }),
        exchange_rate: exchangeRate,
        ...(formData.notes && { notes: formData.notes })
      }
      
      await onSubmit(cleanData)
      onClose()
    } catch (err: any) {
      const msg = err?.message || err?.details || 'Ошибка при сохранении'
      setError(msg)
      console.error('Error submitting vehicle:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'year' || name === 'mileage') 
               ? (value ? parseFloat(value) : undefined)
               : value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-semibold pr-2">
            {vehicle ? 'Редактировать' : 'Добавить авто'}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Марка */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Марка <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Toyota, BMW..."
              />
            </div>

            {/* Модель */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Модель <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Camry, X5..."
              />
            </div>

            {/* Год */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Год выпуска
              </label>
              <IMaskInput
                mask={Number}
                min={1900}
                max={new Date().getFullYear() + 1}
                value={String(formData.year || '')}
                onAccept={(value: string) => setFormData(prev => ({ ...prev, year: value ? Number(value) : undefined }))}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="2020"
              />
            </div>

            {/* VIN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                VIN номер
              </label>
              <IMaskInput
                mask={/^[A-HJ-NPR-Z0-9]{0,17}$/i}
                prepare={(str: string) => str.toUpperCase()}
                value={formData.vin || ''}
                onAccept={(value: string) => setFormData(prev => ({ ...prev, vin: value }))}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono tracking-widest"
                placeholder="17 символов"
              />
              {formData.vin && (
                <p className={`text-xs mt-1 ${formData.vin.length === 17 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formData.vin.length}/17 символов
                </p>
              )}
            </div>



            {/* Цвет */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Цвет
              </label>
              <input
                type="text"
                name="color"
                value={formData.color || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Пробег */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Пробег (км)
              </label>
              <input
                type="number"
                name="mileage"
                value={formData.mileage || ''}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Цена покупки */}
            {vehicle && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Цена покупки</label>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>Курс:</span>
                    <input
                      type="number"
                      value={exchangeRate}
                      onChange={e => setExchangeRate(Number(e.target.value) || 41)}
                      min="1"
                      className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <span>₴/$</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {priceRows.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.label}
                        onChange={e => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, label: e.target.value } : r))}
                        className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Описание (необязательно)"
                      />
                      <input
                        type="number"
                        value={row.amount}
                        onChange={e => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r))}
                        min="0"
                        className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="0"
                      />
                      <div className="flex rounded-lg border border-gray-300 overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, currency: 'USD' } : r))}
                          className={`px-2.5 py-2 text-sm font-medium transition-colors ${row.currency === 'USD' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          $
                        </button>
                        <button
                          type="button"
                          onClick={() => setPriceRows(rows => rows.map(r => r.id === row.id ? { ...r, currency: 'UAH' } : r))}
                          className={`px-2.5 py-2 text-sm font-medium transition-colors ${row.currency === 'UAH' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          ₴
                        </button>
                      </div>
                      {priceRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPriceRows(rows => rows.filter(r => r.id !== row.id))}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPriceRows(rows => [...rows, newRow()])}
                  className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Добавить строку
                </button>

                {totalUSD > 0 && (
                  <p className="mt-2 text-sm text-gray-700">
                    Итого: <span className="font-semibold text-green-700">${totalUSD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    {' = '}
                    <span className="font-semibold">{formatCurrency(totalUAH)}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Примечания */}
          <div className="mt-4 sm:mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              Примечания
            </label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Дополнительная информация..."
            />
          </div>

          {/* Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 font-medium"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 font-medium"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : vehicle ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
