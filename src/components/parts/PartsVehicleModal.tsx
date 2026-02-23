import { useState } from 'react'
import { X } from 'lucide-react'
import type { PartsVehicle, CreatePartsVehicleInput } from '@/types/parts'
import { formatCurrency } from '@/utils/currency'

function parseExpression(expr: string, rate: number): { totalUSD: number; totalUAH: number } {
  // Токены: $500 или 500$ — доллары, просто 500 — гривна
  const tokens = expr.match(/\$?\d+(\.\d+)?\$?/g)
  if (!tokens) return { totalUSD: 0, totalUAH: 0 }
  let totalUSD = 0
  let totalUAH = 0
  for (const token of tokens) {
    const isUSD = token.includes('$')
    const num = parseFloat(token.replace(/\$/g, ''))
    if (isUSD) {
      totalUSD += num
      totalUAH += num * rate
    } else {
      totalUAH += num
      totalUSD += num / rate
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
  const [formData, setFormData] = useState<CreatePartsVehicleInput>({
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle?.year,
    vin: vehicle?.vin || '',
    color: vehicle?.color || '',
    mileage: vehicle?.mileage,
    notes: vehicle?.notes || ''
  })
  const [priceExpr, setPriceExpr] = useState<string>(
    vehicle?.purchase_price ? String(vehicle.purchase_price) : ''
  )
  const [exchangeRate, setExchangeRate] = useState<number>(41)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { totalUSD, totalUAH } = parseExpression(priceExpr, exchangeRate)

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
              <input
                type="number"
                name="year"
                value={formData.year || ''}
                onChange={handleChange}
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* VIN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                VIN номер
              </label>
              <input
                type="text"
                name="vin"
                value={formData.vin || ''}
                onChange={handleChange}
                maxLength={17}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="17 символов"
              />
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

            {/* Цена покупки — только при редактировании */}
            {vehicle && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Цена покупки (₴)
                  </label>
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
                <input
                  type="text"
                  value={priceExpr}
                  onChange={e => setPriceExpr(e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="17000$ + 1500 (₴ → $)"
                />
                {totalUSD > 0 && (
                  <p className="mt-1.5 text-sm text-gray-700">
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
