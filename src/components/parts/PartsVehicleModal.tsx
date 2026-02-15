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
    brand: vehicle?.brand || '',
    model: vehicle?.model || '',
    year: vehicle?.year,
    vin: vehicle?.vin || '',
    license_plate: vehicle?.license_plate || '',
    color: vehicle?.color || '',
    engine_type: vehicle?.engine_type || '',
    transmission_type: vehicle?.transmission_type || '',
    mileage: vehicle?.mileage,
    purchase_price: vehicle?.purchase_price,
    purchase_date: vehicle?.purchase_date || '',
    notes: vehicle?.notes || ''
  })
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
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
      [name]: value === '' ? undefined : 
             (name === 'year' || name === 'mileage' || name === 'purchase_price') 
               ? parseFloat(value) 
               : value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {vehicle ? 'Редактировать автомобиль' : 'Добавить автомобиль на разборку'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Марка */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Марка <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Toyota, BMW, Mercedes..."
              />
            </div>

            {/* Модель */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Модель <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Camry, X5, E-Class..."
              />
            </div>

            {/* Год */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Год выпуска
              </label>
              <input
                type="number"
                name="year"
                value={formData.year || ''}
                onChange={handleChange}
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* VIN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VIN номер
              </label>
              <input
                type="text"
                name="vin"
                value={formData.vin || ''}
                onChange={handleChange}
                maxLength={17}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="17 символов"
              />
            </div>

            {/* Номер */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Гос. номер
              </label>
              <input
                type="text"
                name="license_plate"
                value={formData.license_plate || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Цвет */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Цвет
              </label>
              <input
                type="text"
                name="color"
                value={formData.color || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Двигатель */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тип двигателя
              </label>
              <input
                type="text"
                name="engine_type"
                value={formData.engine_type || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Бензин, Дизель, Электро..."
              />
            </div>

            {/* КПП */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Коробка передач
              </label>
              <select
                name="transmission_type"
                value={formData.transmission_type || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Выберите...</option>
                <option value="МКПП">МКПП</option>
                <option value="АКПП">АКПП</option>
                <option value="Робот">Робот</option>
                <option value="Вариатор">Вариатор</option>
              </select>
            </div>

            {/* Пробег */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Пробег (км)
              </label>
              <input
                type="number"
                name="mileage"
                value={formData.mileage || ''}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Цена покупки */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Цена покупки (₴)
              </label>
              <input
                type="number"
                name="purchase_price"
                value={formData.purchase_price || ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Дата покупки */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Дата покупки
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Примечания */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Примечания
            </label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Дополнительная информация об автомобиле..."
            />
          </div>

          {/* Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
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
