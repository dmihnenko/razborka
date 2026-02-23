import { useState } from 'react'
import { X } from 'lucide-react'
import type { PartsVehicle, CreatePartsVehicleInput } from '@/types/parts'

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
    purchase_price: vehicle?.purchase_price,
    notes: vehicle?.notes || ''
  })
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Убираем undefined значения перед отправкой
      const cleanData: CreatePartsVehicleInput = {
        make: formData.make,
        model: formData.model,
        ...(formData.year && { year: formData.year }),
        ...(formData.vin && { vin: formData.vin }),
        ...(formData.color && { color: formData.color }),
        ...(formData.mileage && { mileage: formData.mileage }),
        ...(formData.purchase_price && { purchase_price: formData.purchase_price }),
        ...(formData.notes && { notes: formData.notes })
      }
      
      await onSubmit(cleanData)
      onClose()
    } catch (error) {
      console.error('Error submitting vehicle:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'year' || name === 'mileage' || name === 'purchase_price') 
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

            {/* Цена покупки */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Цена покупки (₴)
              </label>
              <input
                type="number"
                name="purchase_price"
                value={formData.purchase_price || ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
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
