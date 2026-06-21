import { supabase } from '@/lib/supabase'

export type PhotoProvider = 'imgbb' | 'cloudinary' | 'freeimage'

export interface PhotoStorageConfig {
  provider: PhotoProvider
  imgbb?: { key: string }
  cloudinary?: { cloudName: string; preset: string }
  freeimage?: { key: string }
}

/** Описание сервиса для UI: лимиты + инструкция как получить ключ. */
export interface PhotoServiceMeta {
  id: PhotoProvider
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
 * Конфиг хранилища КОМПАНИИ (не per-device). Защищённо: если миграция
 * (колонки photo_provider/photo_config) ещё не применена — вернёт null,
 * и вызывающий код откатится на прежнее поведение.
 */
export async function getCompanyPhotoStorage(companyId: string): Promise<PhotoStorageConfig | null> {
  try {
    const { data, error } = await supabase
      .from('parts_companies')
      .select('photo_provider, photo_config')
      .eq('id', companyId)
      .maybeSingle()
    if (error || !data) return null
    const cfg = (data as any).photo_config || {}
    return {
      provider: ((data as any).photo_provider as PhotoProvider) || 'imgbb',
      imgbb: cfg.imgbb,
      cloudinary: cfg.cloudinary,
      freeimage: cfg.freeimage,
    }
  } catch {
    return null
  }
}

/** Сохранить конфиг компании. Бросает, если миграция не применена. */
export async function saveCompanyPhotoStorage(companyId: string, cfg: PhotoStorageConfig): Promise<void> {
  const { error } = await supabase
    .from('parts_companies')
    .update({
      photo_provider: cfg.provider,
      photo_config: {
        imgbb: cfg.imgbb,
        cloudinary: cfg.cloudinary,
        freeimage: cfg.freeimage,
      },
    })
    .eq('id', companyId)
  if (error) throw error
}

/** Настроен ли выбранный провайдер (есть ли нужные ключи). */
export function isProviderConfigured(cfg: PhotoStorageConfig | null): boolean {
  if (!cfg) return false
  if (cfg.provider === 'cloudinary') return Boolean(cfg.cloudinary?.cloudName && cfg.cloudinary?.preset)
  if (cfg.provider === 'freeimage') return Boolean(cfg.freeimage?.key)
  return Boolean(cfg.imgbb?.key)
}
