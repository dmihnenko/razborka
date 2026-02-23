export interface ImgbbPhoto {
  url: string
  thumb_url: string
  delete_url: string
}

/** Сжатие файла через Canvas перед загрузкой */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (e) => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => resolve(blob || file),
          'image/jpeg',
          quality
        )
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Загрузка на ImgBB с предварительным сжатием */
export async function uploadToImgbb(file: File, apiKey: string): Promise<ImgbbPhoto> {
  const compressed = await compressImage(file)
  const form = new FormData()
  form.append('key', apiKey)
  form.append('image', compressed, file.name.replace(/\.[^.]+$/, '.jpg'))

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ImgBB: ${res.status} — ${text}`)
  }

  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message || 'ImgBB upload failed')

  return {
    url: json.data.url,
    thumb_url: json.data.thumb?.url || json.data.url,
    delete_url: json.data.delete_url,
  }
}

/** Удаление фото с ImgBB (best-effort через delete_url) */
export async function deleteFromImgbb(delete_url: string): Promise<void> {
  try {
    // imgbb delete работает через GET-запрос на delete_url
    await fetch(delete_url, { method: 'GET', mode: 'no-cors' })
  } catch {
    // Игнорируем ошибки (CORS и т.д.) — best effort
  }
}

/** Удалить массив фото с ImgBB */
export async function deletePhotosFromImgbb(photos: ImgbbPhoto[]): Promise<void> {
  await Promise.all(photos.map(p => deleteFromImgbb(p.delete_url)))
}
