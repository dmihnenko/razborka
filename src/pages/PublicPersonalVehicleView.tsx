import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, Trash2, DollarSign, Upload, Images, FileText } from 'lucide-react'
import { PublicBrandHeader } from '@/components/PublicBrandHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPersonalVehicleById, deletePersonalVehicle, markVehicleAsSold, updatePersonalVehicle } from '@/services/personalVehicles'
import { uploadToImgBB, validateImageFile } from '@/utils/imageStorage'
import { useUserProfile } from '@/hooks/useUserProfile'
import PersonalVehicleExpenses from '@/components/personal-vehicles/PersonalVehicleExpenses'
import VehicleGallery from '@/components/personal-vehicles/VehicleGallery'
import ShareLinkModal from '@/components/personal-vehicles/ShareLinkModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const NO_IMAGE_URL = '/noimage_final.png'

export default function PublicPersonalVehicleView() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const [showShareModal, setShowShareModal] = useState(false)
  const [showSellModal, setShowSellModal] = useState(false)
  const [salePrice, setSalePrice] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showRateModal, setShowRateModal] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)
  const [showCarfaxModal, setShowCarfaxModal] = useState(false)
  const [carfaxInput, setCarfaxInput] = useState('')

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['personal-vehicle', vehicleId],
    queryFn: () => getPersonalVehicleById(vehicleId!),
    enabled: !!vehicleId
  })

  const deleteMutation = useMutation({
    mutationFn: deletePersonalVehicle,
    onSuccess: () => {
      navigate('/my-vehicles')
    },
    onError: (error) => {
      console.error('Failed to delete vehicle:', error)
      alert('Ошибка при удалении автомобиля')
    }
  })

  const sellMutation = useMutation({
    mutationFn: ({ vehicleId, price }: { vehicleId: string; price: number }) =>
      markVehicleAsSold(vehicleId, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-vehicle', vehicleId] })
      setShowSellModal(false)
      setSalePrice('')
    },
    onError: (error) => {
      console.error('Failed to mark as sold:', error)
      alert('Ошибка при сохранении продажи')
    }
  })

  const updatePhotoMutation = useMutation({
    mutationFn: (photoUrl: string) => updatePersonalVehicle(vehicleId!, { photoUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-vehicle', vehicleId] })
    },
    onError: (error) => {
      console.error('Failed to update photo:', error)
      alert('Ошибка при обновлении фото')
    }
  })

  const saveCarfaxMutation = useMutation({
    mutationFn: (url: string) => updatePersonalVehicle(vehicleId!, { carfaxUrl: url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-vehicle', vehicleId] })
      setShowCarfaxModal(false)
    },
    onError: (error) => {
      console.error('Failed to save carfax:', error)
      alert('Ошибка при сохранении ссылки')
    }
  })

  const handleDelete = () => {
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    deleteMutation.mutate(vehicleId!)
    setShowDeleteModal(false)
  }

  const handleSell = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(salePrice)
    if (isNaN(price) || price < 0) {
      alert('Введите корректную цену')
      return
    }
    sellMutation.mutate({ vehicleId: vehicleId!, price })
  }

  const handleSetRate = async (e: React.FormEvent) => {
    e.preventDefault()
    const rate = parseFloat(rateInput)
    if (isNaN(rate) || rate <= 0) {
      alert('Введите корректный курс')
      return
    }
    try {
      await updatePhotoMutation.mutateAsync(vehicle?.photoUrl || '')
      await updatePersonalVehicle(vehicleId!, { usdRate: rate })
      queryClient.invalidateQueries({ queryKey: ['personal-vehicle', vehicleId] })
      setShowRateModal(false)
      setRateInput('')
    } catch (error) {
      console.error('Failed to set USD rate:', error)
      alert('Ошибка при установке курса')
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    setUploadingPhoto(true)
    try {
      const url = await uploadToImgBB(file)
      updatePhotoMutation.mutate(url)
    } catch (error) {
      console.error('Failed to upload photo:', error)
      alert('Ошибка при загрузке фото')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async () => {
    const ok = await showConfirm({ message: 'Удалить фото автомобиля?', danger: true })
    if (!ok) return
    updatePhotoMutation.mutate('')
    setShowPhotoMenu(false)
  }

  const handleChangePhoto = () => {
    document.getElementById('photo-upload-input')?.click()
    setShowPhotoMenu(false)
  }

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['personal-vehicle', vehicleId] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh" style={{ background: 'var(--cab-bg)' }}>
        <div className="h-8 w-8 rounded-full border-2 border-[var(--cab-border)] border-t-[var(--cab-signal)] animate-spin" aria-label="Загрузка" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4" style={{ background: 'var(--cab-bg)' }}>
        <div className="card text-center max-w-sm w-full">
          <p className="text-gray-600 mb-4">Автомобиль не найден</p>
          <button onClick={() => navigate('/my-vehicles')} className="btn-secondary">
            Вернуться к списку
          </button>
        </div>
      </div>
    )
  }

  const isOwner = profile?.id === vehicle.userId

  return (
    <div className="min-h-dvh" style={{ background: 'var(--cab-bg)' }}>
      {!isOwner && <PublicBrandHeader subtitle="Личный автомобиль" />}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* Кнопка назад */}
        <button
          onClick={() => navigate('/my-vehicles')}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 transition-colors text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          Назад к списку
        </button>

        {/* Основная информация */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4 sm:mb-6 md:mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Главное фото */}
            <div className="relative h-48 sm:h-64 md:h-80 lg:h-96 bg-gray-100">
              <img
                src={vehicle.photoUrl || NO_IMAGE_URL}
                alt={vehicle.makeModel}
                className={`w-full h-full object-cover${isOwner && !vehicle.isSold ? ' cursor-pointer' : ''}`}
                onClick={() => { if (isOwner && !vehicle.isSold) setShowPhotoPicker(true) }}
              />
              {isOwner && !vehicle.isSold && (
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 rounded-md px-2 py-1 flex items-center gap-1 pointer-events-none">
                  <Images className="w-3 h-3 text-white" />
                  <span className="text-white text-xs">Выбрать из галереи</span>
                </div>
              )}
              {vehicle.isSold && (
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                  <span className="px-2 py-1 sm:px-3 sm:py-1.5 text-white font-bold rounded-lg shadow-lg text-sm sm:text-base" style={{ background: 'var(--cab-danger)' }}>
                    ПРОДАН
                  </span>
                </div>
              )}
              {isOwner && !vehicle.isSold && (
                <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4">
                  <button
                    onClick={() => setShowPhotoMenu(!showPhotoMenu)}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-white rounded-md transition-colors shadow-lg hover:opacity-90"
                    style={{ background: 'var(--cab-signal)' }}
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{uploadingPhoto ? 'Загрузка...' : 'Изменить фото'}</span>
                    <span className="sm:hidden">{uploadingPhoto ? '...' : 'Фото'}</span>
                  </button>
                  
                  {showPhotoMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowPhotoMenu(false)}
                      />
                      <div className="absolute bottom-full mb-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 min-w-[160px]">
                        <button
                          onClick={handleChangePhoto}
                          className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Изменить
                        </button>
                        {vehicle.photoUrl && (
                          <button
                            onClick={handleDeletePhoto}
                            className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors border-t border-gray-100 hover:bg-gray-50"
                            style={{ color: 'var(--cab-danger)' }}
                          >
                            <Trash2 className="w-4 h-4" />
                            Удалить
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  
                  <input
                    id="photo-upload-input"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                </div>
              )}
            </div>

            {/* Информация */}
            <div className="p-4 sm:p-6 md:p-8 flex flex-col">
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1 sm:mb-2">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                    {vehicle.makeModel}
                  </h1>
                </div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <p className="text-base sm:text-lg md:text-xl text-gray-600">{vehicle.year}</p>
                  {isOwner && (
                    <button
                      onClick={() => setShowRateModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-base font-semibold rounded transition-colors border border-[var(--cab-border)] text-gray-700 hover:bg-gray-50"
                      title="Установить курс USD"
                    >
                      <DollarSign className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                      {vehicle.usdRate ? `${vehicle.usdRate}` : 'USD'}
                    </button>
                  )}
                </div>

                {vehicle.vin && (
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">VIN</p>
                    <p className="text-xs sm:text-sm md:text-base font-mono font-semibold text-gray-900 break-all">{vehicle.vin}</p>
                  </div>
                )}

                {(vehicle.carfaxUrl || (isOwner && !vehicle.isSold)) && (
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">CarFax</p>
                      {vehicle.carfaxUrl ? (
                        <a href={vehicle.carfaxUrl} target="_blank" rel="noreferrer"
                          className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--cab-signal)' }}>
                          <FileText className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> Открыть отчёт
                        </a>
                      ) : (
                        <p className="text-sm text-gray-400">Не добавлен</p>
                      )}
                    </div>
                    {isOwner && !vehicle.isSold && (
                      <button
                        onClick={() => { setCarfaxInput(vehicle.carfaxUrl || ''); setShowCarfaxModal(true) }}
                        className="flex-shrink-0 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded border border-gray-200 hover:bg-white transition-colors"
                      >
                        {vehicle.carfaxUrl ? 'Изменить' : 'Добавить'}
                      </button>
                    )}
                  </div>
                )}

                {vehicle.isSold && vehicle.salePrice ? (() => {
                  // Рассчитываем Grand Total один раз
                  const usdRate = vehicle.usdRate || 1
                  const allItems = [
                    ...(vehicle.lotItems || []),
                    ...(vehicle.partsItems || []),
                    ...(vehicle.workItems || []),
                    ...(vehicle.additionalItems || [])
                  ]
                  const totalUSD = allItems.filter(i => i.currency === 'USD').reduce((s, i) => s + i.cost, 0)
                  const totalUAH = allItems.filter(i => i.currency === 'UAH').reduce((s, i) => s + i.cost, 0)
                  const grandTotal = totalUSD + (totalUAH / usdRate)
                  const profit = vehicle.salePrice - grandTotal
                  const isProfitable = profit >= 0

                  return (
                    <div className="space-y-3 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Затраты</p>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">Total USD:</span>
                            <span className="font-semibold text-gray-900 tabular-nums">${totalUSD.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">Total UAH:</span>
                            <span className="font-semibold text-gray-900 tabular-nums">{Number(totalUAH || 0).toFixed(2)} грн</span>
                          </div>
                          <div className="border-t border-gray-300 pt-2 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-gray-900">Grand Total:</span>
                              <span className="font-bold text-xl tabular-nums text-[var(--cab-signal)]">${grandTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Продано</p>
                            <p className="text-2xl font-bold text-gray-900 tabular-nums">${vehicle.salePrice.toFixed(2)}</p>
                          </div>
                          <div className="p-3 rounded-full" style={{ background: 'var(--cab-signal-weak)' }}>
                            <DollarSign className="w-6 h-6 text-[var(--cab-signal)]" strokeWidth={1.5} />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg p-4 border bg-white" style={{ borderColor: isProfitable ? 'var(--cab-success)' : 'var(--cab-danger)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: isProfitable ? 'var(--cab-success)' : 'var(--cab-danger)' }}>
                              {isProfitable ? 'Прибыль' : 'Убыток'}
                            </p>
                            <p className="text-3xl font-bold tabular-nums" style={{ color: isProfitable ? 'var(--cab-success)' : 'var(--cab-danger)' }}>
                              {isProfitable ? '+' : ''}${profit.toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 rounded-full" style={{ background: isProfitable ? 'var(--cab-success-weak)' : 'var(--cab-danger-weak)' }}>
                            <DollarSign className="w-7 h-7" strokeWidth={1.5} style={{ color: isProfitable ? 'var(--cab-success)' : 'var(--cab-danger)' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })() : (() => {
                  // Для непроданных автомобилей показываем общую стоимость
                  const usdRate = vehicle.usdRate || 1
                  const allItems = [
                    ...(vehicle.lotItems || []),
                    ...(vehicle.partsItems || []),
                    ...(vehicle.workItems || []),
                    ...(vehicle.additionalItems || [])
                  ]
                  const totalUSD = allItems.filter(i => i.currency === 'USD').reduce((s, i) => s + i.cost, 0)
                  const totalUAH = allItems.filter(i => i.currency === 'UAH').reduce((s, i) => s + i.cost, 0)
                  const grandTotal = totalUSD + (totalUAH / usdRate)

                  return (
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 border border-gray-200">
                      <h4 className="font-bold text-gray-900 mb-3 sm:mb-4 text-base sm:text-lg">Общая стоимость</h4>
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm sm:text-base text-gray-700">Total USD:</span>
                          <span className="font-semibold text-sm sm:text-base text-gray-900 tabular-nums">${totalUSD.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm sm:text-base text-gray-700">Total UAH:</span>
                          <span className="font-semibold text-sm sm:text-base text-gray-900 tabular-nums">{Number(totalUAH || 0).toFixed(2)} грн</span>
                        </div>
                        <div className="border-t border-gray-300 pt-2 sm:pt-3 mt-2 sm:mt-3">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-900 text-base sm:text-lg">Grand Total:</span>
                            <span className="font-bold text-lg sm:text-xl md:text-2xl tabular-nums text-[var(--cab-signal)]">${grandTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Действия владельца */}
              {isOwner && !vehicle.isSold && (
                <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                  <button onClick={() => setShowShareModal(true)} className="btn-secondary flex-1">
                    <Share2 className="w-4 h-4" strokeWidth={1.5} />
                    Поделиться
                  </button>

                  <button onClick={() => setShowSellModal(true)} className="btn-primary flex-1">
                    <DollarSign className="w-4 h-4" strokeWidth={1.5} />
                    Продать
                  </button>

                  <button onClick={handleDelete} className="btn-danger flex-1">
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Расходы */}
        <div className="mb-8">
          <PersonalVehicleExpenses
            vehicleId={vehicle.id}
            vehicle={vehicle}
            isOwner={isOwner}
            onUpdate={handleUpdate}
          />
        </div>

        {/* Галерея */}
        <div>
          <VehicleGallery
            vehicleId={vehicle.id}
            vehicle={vehicle}
            isOwner={isOwner}
            onUpdate={handleUpdate}
            onSetMainPhoto={(url) => updatePhotoMutation.mutate(url)}
          />
        </div>
      </div>

      {/* Модалки */}
      {/* Пикер главного фото из галереи */}
      {showPhotoPicker && (() => {
        const allPhotos = [
          ...(vehicle.usaPhotos || []),
          ...(vehicle.portPhotos || []),
          ...(vehicle.arrivalPhotos || []),
        ]
        return (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={() => setShowPhotoPicker(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Выбрать главное фото</h3>
                <button onClick={() => setShowPhotoPicker(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              {allPhotos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Нет фотографий в галерее. Сначала загрузите фото.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                  {allPhotos.map((photo, i) => {
                    const isMain = vehicle.photoUrl === photo.url
                    return (
                      <div
                        key={i}
                        onClick={() => { if (!isMain) { updatePhotoMutation.mutate(photo.url); setShowPhotoPicker(false) } }}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${isMain ? 'cursor-default' : 'border-transparent cursor-pointer'}`}
                        style={isMain ? { borderColor: 'var(--cab-signal)' } : undefined}
                      >
                        <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        {isMain && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--cab-signal) 25%, transparent)' }}>
                            <span className="text-white text-xs font-bold px-2 py-1 rounded" style={{ background: 'var(--cab-signal)' }}>Текущее</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {showShareModal && (
        <ShareLinkModal
          isOpen={true}
          onClose={() => setShowShareModal(false)}
          vehicleId={vehicle.id}
          userId={vehicle.userId}
        />
      )}

      {showCarfaxModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowCarfaxModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Ссылка на CarFax отчёт</h3>
            <input
              type="url"
              inputMode="url"
              value={carfaxInput}
              onChange={(e) => setCarfaxInput(e.target.value)}
              className="form-input"
              placeholder="https://www.carfax.com/..."
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => saveCarfaxMutation.mutate(carfaxInput.trim())}
                disabled={saveCarfaxMutation.isPending}
                className="btn-primary flex-1"
              >
                {saveCarfaxMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => setShowCarfaxModal(false)} className="btn-secondary flex-1">Отмена</button>
            </div>
            {vehicle.carfaxUrl && (
              <button
                onClick={() => saveCarfaxMutation.mutate('')}
                disabled={saveCarfaxMutation.isPending}
                className="mt-3 text-xs text-red-600 hover:underline"
              >
                Удалить ссылку
              </button>
            )}
          </div>
        </div>
      )}

      {showSellModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Отметить как проданный</h3>
            <form onSubmit={handleSell}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Цена продажи (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="form-input"
                  placeholder="12000.00"
                  required
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-1">
                  Цена покупки: ${vehicle.totalCost.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={sellMutation.isPending} className="btn-primary flex-1">
                  {sellMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setShowSellModal(false)} className="btn-secondary flex-1">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Установить курс USD</h3>
            <form onSubmit={handleSetRate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Курс USD (1 USD = ? UAH)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="form-input"
                  placeholder="40.50"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={updatePhotoMutation.isPending} className="btn-primary flex-1">
                  {updatePhotoMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setShowRateModal(false)} className="btn-secondary flex-1">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--cab-danger)' }}>Удалить автомобиль?</h3>
            <p className="text-gray-700 mb-6">
              Это действие нельзя отменить. Все данные об автомобиле, расходах и фотографиях будут удалены безвозвратно.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={confirmDelete} disabled={deleteMutation.isPending} className="btn-danger flex-1">
                {deleteMutation.isPending ? 'Удаление...' : 'Да, удалить'}
              </button>
              <button type="button" onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
