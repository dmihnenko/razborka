import { useSyncProfileLocale } from '@/hooks/useSyncProfileLocale'

/** Применяет язык из профиля (БД) для залогиненного пользователя. Ничего не рендерит. */
export default function LocaleSync() {
  useSyncProfileLocale()
  return null
}
