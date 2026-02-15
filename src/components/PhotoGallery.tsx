import { PhotoProvider, PhotoView } from 'react-photo-view'
import { X, ZoomIn, Download } from 'lucide-react'
import 'react-photo-view/dist/react-photo-view.css'

interface Photo {
  src: string
  alt?: string
  caption?: string
}

interface PhotoGalleryProps {
  photos: Photo[]
  className?: string
}

export function PhotoGallery({ photos, className = '' }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Нет фотографий</p>
      </div>
    )
  }

  return (
    <PhotoProvider
      toolbarRender={({ onScale, scale, rotate, onRotate }) => (
        <div className="flex items-center gap-2 p-2 bg-black/50 rounded-lg">
          <button
            onClick={() => onScale(scale + 0.5)}
            className="p-2 text-white hover:bg-white/20 rounded"
            title="Увеличить"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={() => onRotate(rotate + 90)}
            className="p-2 text-white hover:bg-white/20 rounded"
            title="Повернуть"
          >
            ↻
          </button>
        </div>
      )}
      maskOpacity={0.8}
      speed={() => 300}
      easing={(type) =>
        type === 2
          ? 'cubic-bezier(0.36, 0, 0.66, -0.56)'
          : 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }
    >
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
        {photos.map((photo, index) => (
          <PhotoView key={index} src={photo.src}>
            <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
              <img
                src={photo.src}
                alt={photo.alt || `Фото ${index + 1}`}
                className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
              </div>
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-sm">
                  {photo.caption}
                </div>
              )}
            </div>
          </PhotoView>
        ))}
      </div>
    </PhotoProvider>
  )
}

// Компонент для одиночного просмотра фото
interface SinglePhotoViewProps {
  src: string
  alt?: string
  className?: string
  thumbnailClassName?: string
}

export function SinglePhotoView({
  src,
  alt = 'Фото',
  className = '',
  thumbnailClassName = '',
}: SinglePhotoViewProps) {
  return (
    <PhotoProvider>
      <PhotoView src={src}>
        <img
          src={src}
          alt={alt}
          className={`cursor-pointer hover:opacity-90 transition-opacity ${thumbnailClassName}`}
        />
      </PhotoView>
    </PhotoProvider>
  )
}

// Компонент для списка фотографий (вертикальный список)
interface PhotoListProps {
  photos: Photo[]
  onDownload?: (photo: Photo) => void
  onDelete?: (photo: Photo, index: number) => void
}

export function PhotoList({ photos, onDownload, onDelete }: PhotoListProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Нет фотографий</p>
      </div>
    )
  }

  return (
    <PhotoProvider>
      <div className="space-y-3">
        {photos.map((photo, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <PhotoView src={photo.src}>
              <img
                src={photo.src}
                alt={photo.alt || `Фото ${index + 1}`}
                className="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-80"
              />
            </PhotoView>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {photo.alt || `Фото ${index + 1}`}
              </p>
              {photo.caption && (
                <p className="text-xs text-gray-500 truncate">{photo.caption}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onDownload && (
                <button
                  onClick={() => onDownload(photo)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="Скачать"
                >
                  <Download size={18} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(photo, index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  title="Удалить"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </PhotoProvider>
  )
}
