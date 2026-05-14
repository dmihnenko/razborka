import { useState } from 'react'
import { X, Upload } from 'lucide-react'
import { uploadToImgBB, validateImageFile } from '@/utils/imageStorage'
import type { CreatePersonalVehicleInput } from '@/types/personalVehicles'
import { useAlert } from '../CustomAlert'
import { useBlockScroll } from '@/hooks/useBlockScroll'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (vehicleId: string) => void
  userId: string
}

export default function PersonalVehicleModal({ isOpen, onClose, onSuccess, userId }: Props) {
  const { showAlert } = useAlert()
  const [formData, setFormData] = useState<CreatePersonalVehicleInput>({
    makeModel: '',
    year: new Date().getFullYear(),
    vin: '',
    photoUrl: '',
    usdRate: undefined
  })
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)

  useBlockScroll(isOpen)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      showAlert(validation.error || 'Ошибка валидации', 'error')
      return
    }

    setUploading(true)
    try {
      const url = await uploadToImgBB(file)
      setFormData({ ...formData, photoUrl: url })
    } catch (error) {
      console.error('Failed to upload photo:', error)
      showAlert('Ошибка при загрузке фото', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.makeModel.trim().length < 3) {
      showAlert('Марка и модель должны содержать минимум 3 символа', 'error')
      return
    }

    if (formData.year < 1900 || formData.year > 2027) {
      showAlert('Год должен быть в диапазоне 1900-2027', 'error')
      return
    }

    if (formData.vin && formData.vin.length !== 17) {
      showAlert('VIN номер должен содержать 17 символов', 'error')
      return
    }

    if (formData.usdRate !== undefined && formData.usdRate <= 0) {
      showAlert('Курс USD должен быть положительным числом', 'error')
      return
    }

    setCreating(true)
    try {
      const { createPersonalVehicle } = await import('@/services/personalVehicles')
      const vehicleId = await createPersonalVehicle(userId, {
        ...formData,
        vin: formData.vin || undefined,
        usdRate: formData.usdRate || undefined
      })
      
      onSuccess(vehicleId)
      onClose()
      
      // Сброс формы
      setFormData({
        makeModel: '',
        year: new Date().getFullYear(),
        vin: '',
        photoUrl: '',
        usdRate: undefined
      })
    } catch (error) {
      console.error('Failed to create vehicle:', error)
      showAlert('Ошибка при создании автомобиля', 'error')
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Добавить автомобиль</h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-5">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Марка и модель *
            </label>
            <input
              type="text"
              value={formData.makeModel}
              onChange={(e) => setFormData({ ...formData, makeModel: e.target.value })}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tesla Model X"
              required
              minLength={3}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Год выпуска *
            </label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1900}
              max={2027}
              required
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              VIN номер
            </label>
            <input
              type="text"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="5YJXCAE21HF000123"
              maxLength={17}
            />
            {formData.vin && formData.vin.length !== 17 && (
              <p className="text-red-600 text-xs sm:text-sm mt-1">VIN должен содержать 17 символов</p>
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Курс USD (1 USD = ? UAH)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.usdRate || ''}
              onChange={(e) => setFormData({ ...formData, usdRate: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="40.50"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Фото автомобиля
            </label>
            {formData.photoUrl ? (
              <div className="relative">
                <img
                  src={formData.photoUrl}
                  alt="Vehicle"
                  className="w-full h-32 sm:h-40 md:h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, photoUrl: '' })}
                  className="absolute top-1 sm:top-2 right-1 sm:right-2 p-1 sm:p-2 bg-red-700 text-white rounded-full hover:bg-red-800 transition-colors"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 sm:h-28 md:h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-3 sm:pt-4 md:pt-5 pb-4 sm:pb-5 md:pb-6">
                  <Upload className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-gray-400 mb-1 sm:mb-2" />
                  <p className="text-xs sm:text-sm text-gray-600">
                    {uploading ? 'Загрузка...' : 'Нажмите для выбора фото'}
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button><button
              type="submit"
              disabled={creating || uploading}
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Создание...' : 'Создать'}
            </button>
            
          </div>
        </form>
      </div>
    </div>
  )
}
