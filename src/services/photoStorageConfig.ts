import { supabase } from '@/lib/supabase'

/** shared = общее хранилище razborka.net (R2) с лимитом по тарифу; остальные — свой сервис. */
export type PhotoProvider = 'shared' | 'imgbb' | 'cloudinary' | 'freeimage'

export interface PhotoStorageConfig {
  provider: PhotoProvider
  imgbb?: { key: string }
  cloudinary?: { cloudName: string; preset: string }
  freeimage?: { key: string }
}

/** Описание сервиса для UI: лимиты + инструкция как получить ключ. */
export interface PhotoServiceMeta {
  id: Exclude<PhotoProvider, 'shared'>
  name: string
  limits: string
  signupUrl: string
  /** Шаги получения ключа/пресета. */
  steps: string[]
  /** Поля конфигурации, которые вводит пользователь. */
  fields: { key: 'key' | 'cloudName' | 'preset'; label: string; placeholder: string }[]
}

export const PHOTO_SERVICES: PhotoServiceMeta[] = [
  {
    id: 'imgbb',
    name: 'ImgBB',
    limits: 'Бесплатно · хранилище без лимита · до 32 МБ на фото',
    signupUrl: 'https://api.imgbb.com/',
    steps: [
      'Откройте api.imgbb.com и войдите (или зарегистрируйтесь).',
      'Нажмите «Get API key» и скопируйте ключ.',
      'Вставьте ключ ниже и сохраните.',
    ],
    fields: [{ key: 'key', label: 'API ключ', placeholder: 'например: 1a2b3c...' }],
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    limits: 'Бесплатно · 25 ГБ · авто-оптимизация и трансформации',
    signupUrl: 'https://cloudinary.com/users/register_free',
    steps: [
      'Зарегистрируйтесь на cloudinary.com (бесплатный план).',
      'На Dashboard скопируйте «Cloud name».',
      'Settings → Upload → Add upload preset → Signing Mode: Unsigned → сохраните и скопируйте имя пресета.',
      'Впишите Cloud name и имя пресета ниже и сохраните.',
    ],
    fields: [
      { key: 'cloudName', label: 'Cloud name', placeholder: 'например: my-razborka' },
      { key: 'preset', label: 'Upload preset (unsigned)', placeholder: 'имя пресета' },
    ],
  },
  {
    id: 'freeimage',
    name: 'freeimage.host',
    limits: 'Бесплатно · хранилище без лимита · до 64 МБ на фото',
    signupUrl: 'https://freeimage.host/page/api',
    steps: [
      'Откройте freeimage.host → страница API.',
      'Скопируйте ваш API-ключ (V1 API key).',
      'Вставьте ключ ниже и сохраните.',
    ],
    fields: [{ key: 'key', label: 'API ключ', placeholder: 'например: 6d2...' }],
  },
]

/**
 * Конфиг хранилища КОМПАНИИ (не per-device), читается через RPC get_my_photo_storage.
 * При сбое RPC БРОСАЕТ ошибку (иначе загрузка молча ушла бы не туда). null — у пользователя нет компании.
 */
export async function getCompanyPhotoStorage(_companyId?: string): Promise<PhotoStorageConfig | null> {
  const { data, error } = await supabase.rpc('get_my_photo_storage')
  if (error) throw error
  if (!data) return null
  const row = data as { provider?: string; config?: any }
  const cfg = row.config || {}
  const base = {
    imgbb: cfg.imgbb,
    cloudinary: cfg.cloudinary,
    freeimage: cfg.freeimage,
  }
  const chosen = (row.provider as PhotoProvider) || 'shared'
  // Выбранный сервис без ключа -> общее хранилище razborka.net
  const provider: PhotoProvider = chosen !== 'shared' && !isProviderConfigured({ provider: chosen, ...base }) ? 'shared' : chosen
  return { provider, ...base }
}

export interface PhotoUsage {
  used_bytes: number
  limit_bytes: number | null
  /** Сколько фото загружено и сколько разрешено тарифом (null = без лимита) */
  used_photos: number
  limit_photos: number | null
}

/** Занято / лимит общего хранилища razborka.net (null-лимит = без ограничения). */
export async function getMyPhotoUsage(): Promise<PhotoUsage | null> {
  const { data, error } = await supabase.rpc('get_my_photo_usage')
  if (error || !data) return null
  const d = data as { used_bytes?: number; limit_bytes?: number | null; used_photos?: number; limit_photos?: number | null }
  return {
    used_bytes: Number(d.used_bytes) || 0,
    limit_bytes: d.limit_bytes == null ? null : Number(d.limit_bytes),
    used_photos: Number(d.used_photos) || 0,
    limit_photos: d.limit_photos == null ? null : Number(d.limit_photos),
  }
}

/** Сохранить конфиг компании через RPC save_my_photo_storage (сервер СЛИВАЕТ config: ключи не теряются). */
export async function saveCompanyPhotoStorage(_companyId: string, cfg: PhotoStorageConfig): Promise<void> {
  const config: Record<string, unknown> = {}
  if (cfg.imgbb?.key) config.imgbb = cfg.imgbb
  if (cfg.cloudinary?.cloudName || cfg.cloudinary?.preset) config.cloudinary = cfg.cloudinary
  if (cfg.freeimage?.key) config.freeimage = cfg.freeimage
  const { error } = await supabase.rpc('save_my_photo_storage', { p_provider: cfg.provider, p_config: config })
  if (error) throw error
}

/** Настроен ли выбранный провайдер (есть ли нужные ключи). */
export function isProviderConfigured(cfg: PhotoStorageConfig | null): boolean {
  if (!cfg) return false
  if (cfg.provider === 'shared') return true
  if (cfg.provider === 'cloudinary') return Boolean(cfg.cloudinary?.cloudName && cfg.cloudinary?.preset)
  if (cfg.provider === 'freeimage') return Boolean(cfg.freeimage?.key)
  return Boolean(cfg.imgbb?.key)
}
