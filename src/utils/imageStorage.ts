/**
 * Оптимизация изображения перед загрузкой
 * Уменьшает размер и качество для экономии места и ускорения загрузки
 */
async function optimizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Максимальные размеры
        const MAX_WIDTH = 1920
        const MAX_HEIGHT = 1920
        const QUALITY = 0.85 // 85% качество
        
        let width = img.width
        let height = img.height
        
        // Пропорциональное уменьшение если больше максимума
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
          width = Math.floor(width * ratio)
          height = Math.floor(height * ratio)
        }
        
        // Создаем canvas для ресайза
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        
        // Рисуем оптимизированное изображение
        ctx.drawImage(img, 0, 0, width, height)
        
        // Конвертируем в Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }
            
            // Создаем новый File из Blob
            const optimizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            
            resolve(optimizedFile)
          },
          'image/jpeg',
          QUALITY
        )
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * Загрузка изображения на imgBB с предварительной оптимизацией
 * Использует API key из переменных окружения
 */
export async function uploadToImgBB(file: File): Promise<string> {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY

  if (!apiKey) {
    throw new Error('imgBB API key not configured. Please set VITE_IMGBB_API_KEY in .env file')
  }

  // Оптимизируем изображение перед загрузкой
  const optimizedFile = await optimizeImage(file)

  const formData = new FormData()
  formData.append('image', optimizedFile)
  formData.append('key', apiKey)

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || 'Failed to upload image to imgBB')
  }

  const data = await response.json()
  return data.data.url
}

/**
 * Валидация файла изображения
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Проверка типа файла
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Неподдерживаемый формат файла. Разрешены: JPEG, PNG, GIF, WebP'
    }
  }

  // Проверка размера (максимум 10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Размер файла не должен превышать 10MB'
    }
  }

  return { valid: true }
}

/**
 * Загрузка нескольких изображений
 */
export async function uploadMultipleToImgBB(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(file => uploadToImgBB(file))
  return Promise.all(uploadPromises)
}
