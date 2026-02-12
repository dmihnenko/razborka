import { useState, useCallback } from 'react'
import { Upload, X, ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import type { PersonalVehicle, PhotoAlbum, VehiclePhoto } from '@/types/personalVehicles'
import { ALBUM_LABELS } from '@/types/personalVehicles'
import { uploadToImgBB, validateImageFile } from '@/utils/imageStorage'
import { addVehiclePhoto, deleteVehiclePhoto } from '@/services/personalVehicles'
import { useAlert } from '../CustomAlert'

interface Props {
  vehicleId: string
  vehicle: PersonalVehicle
  isOwner: boolean
  onUpdate: () => void
}

export default function VehicleGallery({ vehicleId, vehicle, isOwner, onUpdate }: Props) {
  const { showAlert } = useAlert()
  const [activeAlbum, setActiveAlbum] = useState<PhotoAlbum>('usaPhotos')
  const [modalPhoto, setModalPhoto] = useState<{ url: string; index: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const currentPhotos = vehicle[activeAlbum]

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!isOwner) return

    setUploading(true)
    setUploadProgress(0)

    try {
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        
        const validation = validateImageFile(file)
        if (!validation.valid) {
          showAlert(`${file.name}: ${validation.error}`, 'error')
          continue
        }

        const url = await uploadToImgBB(file)
        
        const photo: VehiclePhoto = {
          url,
          uploadedAt: new Date().toISOString(),
          fileName: file.name
        }

        await addVehiclePhoto(vehicleId, activeAlbum, photo)
        setUploadProgress(((i + 1) / acceptedFiles.length) * 100)
      }

      onUpdate()
    } catch (error) {
      console.error('Failed to upload photos:', error)
      showAlert('Ошибка при загрузке фото', 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [vehicleId, activeAlbum, isOwner, onUpdate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    disabled: !isOwner
  })

  const handleDeletePhoto = async (index: number) => {
    if (!confirm('Удалить это фото?')) return

    try {
      await deleteVehiclePhoto(vehicleId, activeAlbum, index)
      onUpdate()
      if (modalPhoto && modalPhoto.index === index) {
        setModalPhoto(null)
      }
    } catch (error) {
      console.error('Failed to delete photo:', error)
      showAlert('Ошибка при удалении фото', 'error')
    }
  }

  const handlePrevPhoto = () => {
    if (!modalPhoto) return
    const newIndex = modalPhoto.index > 0 ? modalPhoto.index - 1 : currentPhotos.length - 1
    setModalPhoto({ url: currentPhotos[newIndex].url, index: newIndex })
  }

  const handleNextPhoto = () => {
    if (!modalPhoto) return
    const newIndex = modalPhoto.index < currentPhotos.length - 1 ? modalPhoto.index + 1 : 0
    setModalPhoto({ url: currentPhotos[newIndex].url, index: newIndex })
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!modalPhoto) return
    
    if (e.key === 'Escape') {
      setModalPhoto(null)
    } else if (e.key === 'ArrowLeft') {
      handlePrevPhoto()
    } else if (e.key === 'ArrowRight') {
      handleNextPhoto()
    }
  }, [modalPhoto])

  useState(() => {
    if (modalPhoto) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  })

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Галерея фотографий</h3>

      {/* Табы альбомов */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['usaPhotos', 'portPhotos', 'arrivalPhotos'] as PhotoAlbum[]).map((album) => (
          <button
            key={album}
            onClick={() => setActiveAlbum(album)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeAlbum === album
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {ALBUM_LABELS[album]} ({vehicle[album]?.length || 0})
          </button>
        ))}
      </div>

      {/* Drag & Drop зона */}
      {isOwner && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          {uploading ? (
            <div>
              <p className="text-gray-700 font-medium mb-2">Загрузка... {uploadProgress.toFixed(0)}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-700 font-medium mb-1">
                {isDragActive ? 'Отпустите файлы здесь' : 'Перетащите фото сюда'}
              </p>
              <p className="text-gray-500 text-sm">или нажмите для выбора файлов</p>
              <p className="text-gray-400 text-xs mt-2">JPEG, PNG, GIF, WebP (макс. 10MB)</p>
            </div>
          )}
        </div>
      )}

      {/* Сетка фотографий */}
      {currentPhotos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Нет фотографий в этом альбоме</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentPhotos.map((photo, index) => (
            <div
              key={index}
              className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
              onClick={() => setModalPhoto({ url: photo.url, index })}
            >
              <img
                src={photo.url}
                alt={photo.fileName || `Photo ${index + 1}`}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-medium">Просмотр</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно просмотра */}
      {modalPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setModalPhoto(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>

          <button
            onClick={handlePrevPhoto}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-12 h-12" />
          </button>

          <button
            onClick={handleNextPhoto}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors"
          >
            <ChevronRight className="w-12 h-12" />
          </button>

          <div className="max-w-6xl max-h-[90vh] flex flex-col">
            <img
              src={modalPhoto.url}
              alt="Full size"
              className="max-w-full max-h-[80vh] object-contain"
            />

            <div className="flex gap-4 justify-center mt-4">
              <a
                href={modalPhoto.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Скачать
              </a>

              {isOwner && (
                <button
                  onClick={() => handleDeletePhoto(modalPhoto.index)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              )}

              <button
                onClick={() => setModalPhoto(null)}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Закрыть
              </button>
            </div>

            <p className="text-white text-center mt-2 text-sm">
              {modalPhoto.index + 1} / {currentPhotos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
