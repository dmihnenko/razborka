import { useState } from 'react'
import { Copy, X, Trash2 } from 'lucide-react'
import type { VehicleShareLink } from '@/types/personalVehicles'
import { createVehicleShareLink, getVehicleShareLinks, deactivateVehicleShareLink } from '@/services/personalVehicles'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAlert } from '../CustomAlert'

interface Props {
  isOpen: boolean
  onClose: () => void
  vehicleId: string
  userId: string
}

export default function ShareLinkModal({ isOpen, onClose, vehicleId, userId }: Props) {
  const { showAlert } = useAlert()
  const [expiresInDays, setExpiresInDays] = useState('')
  const [selectedDuration, setSelectedDuration] = useState<'1hour' | '7days' | 'permanent'>('permanent')
  const [newCode, setNewCode] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: shareLinks = [], isLoading } = useQuery({
    queryKey: ['vehicle-share-links', vehicleId],
    queryFn: () => getVehicleShareLinks(vehicleId),
    enabled: isOpen
  })

  const createMutation = useMutation({
    mutationFn: () => {
      let expiresInDays: number | undefined
      if (selectedDuration === '1hour') {
        expiresInDays = 1 / 24 // 1 час = 1/24 дня
      } else if (selectedDuration === '7days') {
        expiresInDays = 7
      } else {
        expiresInDays = undefined // Бессрочный
      }
      return createVehicleShareLink(vehicleId, userId, expiresInDays)
    },
    onSuccess: (data) => {
      setNewCode(data.code)
      queryClient.invalidateQueries({ queryKey: ['vehicle-share-links', vehicleId] })
    },
    onError: (error) => {
      console.error('Failed to create share link:', error)
      showAlert('Ошибка при создании кода', 'error')
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: (linkId: string) => deactivateVehicleShareLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-share-links', vehicleId] })
    },
    onError: (error) => {
      console.error('Failed to deactivate link:', error)
      showAlert('Ошибка при деактивации кода', 'error')
    }
  })

  const handleCopyCode = (code: string) => {
    const link = `${window.location.origin}/vehicle-access?code=${code}`
    navigator.clipboard.writeText(link)
    toast.success('Ссылка скопирована в буфер обмена', { duration: 500 })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isExpired = (link: VehicleShareLink) => {
    if (!link.expiresAt) return false
    return new Date(link.expiresAt) < new Date()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Коды доступа</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Создание нового кода */}
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
            <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <button
                onClick={() => setSelectedDuration('1hour')}
                className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  selectedDuration === '1hour'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                1 час
              </button>
              <button
                onClick={() => setSelectedDuration('7days')}
                className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  selectedDuration === '7days'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                7 дней
              </button>
              <button
                onClick={() => setSelectedDuration('permanent')}
                className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                  selectedDuration === 'permanent'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Бессрочный
              </button>
            </div>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-green-600 text-white font-medium text-xs sm:text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {createMutation.isPending ? 'Создание...' : '✓ Сгенерировать код'}
            </button>

            {newCode && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-white rounded-md border-2 border-green-500">
                <p className="text-xs sm:text-sm text-gray-600 mb-2">Новый код создан:</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 tracking-wider break-all">{newCode}</span>
                  <button
                    onClick={() => handleCopyCode(newCode)}
                    className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    title="Копировать код"
                  >
                    <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                <button
                  onClick={() => handleCopyCode(newCode)}
                  className="mt-2 sm:mt-3 w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-700 text-xs sm:text-sm rounded hover:bg-gray-200 transition-colors"
                >
                  Копировать ссылку для отправки
                </button>
              </div>
            )}
          </div>

          {/* Список активных кодов */}
          <div>
            <h4 className="font-semibold text-gray-900 text-xs sm:text-sm mb-2">Активные коды</h4>
            {isLoading ? (
              <p className="text-gray-500 text-center py-3 text-xs sm:text-sm">Загрузка...</p>
            ) : shareLinks.length === 0 ? (
              <p className="text-gray-500 text-center py-3 text-xs sm:text-sm">Нет активных кодов</p>
            ) : (
              <div className="space-y-2">
                {shareLinks.map((link) => (
                  <div
                    key={link.id}
                    className={`p-2 sm:p-3 rounded-md border ${
                      isExpired(link)
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <span className="text-base sm:text-lg md:text-xl font-bold text-gray-900 tracking-wider">
                          {link.code}
                        </span>
                        {isExpired(link) && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] sm:text-xs rounded whitespace-nowrap">
                            Истек
                          </span>
                        )}
                        {!link.expiresAt && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] sm:text-xs rounded whitespace-nowrap">
                            Бессрочный
                          </span>
                        )}
                        <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap hidden sm:inline">
                          {formatDate(link.createdAt)}
                          {link.expiresAt && ` • ${formatDate(link.expiresAt)}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleCopyCode(link.code)}
                          className="p-1 sm:p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Копировать ссылку"
                        >
                          <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Деактивировать этот код?')) {
                              deactivateMutation.mutate(link.id)
                            }
                          }}
                          className="p-1 sm:p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Деактивировать"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 text-xs sm:text-sm rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
