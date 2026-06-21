import type { ImgbbPhoto } from './imgbbService'
import { compressImage } from './imgbbService'

// freeimage.host — бесплатный хостинг (движок Chevereto, как у ImgBB), но больше
// лимит на файл. Unsigned-загрузка по API-ключу с клиента, как у ImgBB.
// Удаление с клиента недоступно (нужна авторизация) → delete_url пустой.
export async function uploadToFreeimage(file: File, apiKey: string): Promise<ImgbbPhoto> {
  if (!apiKey) throw new Error('freeimage.host не настроен')

  const compressed = await compressImage(file)
  const ext = compressed.type === 'image/webp' ? '.webp' : '.jpg'
  const form = new FormData()
  form.append('key', apiKey)
  form.append('action', 'upload')
  form.append('format', 'json')
  form.append('source', compressed, file.name.replace(/\.[^.]+$/, ext))

  const res = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`freeimage: ${res.status} — ${text}`)
  }
  const json = await res.json()
  if (json.status_code !== 200 || !json.image) {
    throw new Error(json.error?.message || 'freeimage upload failed')
  }
  const img = json.image
  return {
    url: img.url || img.display_url,
    medium_url: img.medium?.url || img.display_url || undefined,
    thumb_url: img.thumb?.url || img.url,
    delete_url: '',
  }
}
