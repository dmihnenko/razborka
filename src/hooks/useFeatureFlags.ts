import { useQuery } from '@tanstack/react-query'
import { getFeatureFlags, type FeatureFlag } from '@/services/featureFlagsService'

/** Все флаги (кэш 5 мин). Публичные — грузятся и для анонимов. */
export function useFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ['feature-flags'],
    queryFn: getFeatureFlags,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Признак включённости одной опции. По умолчанию (пока флаги грузятся или флаг
 * отсутствует) — false, чтобы новые фичи не «мигали» до подтверждения.
 */
export function useFeatureFlag(key: string): boolean {
  const { data } = useFeatureFlags()
  return !!data?.find((f) => f.key === key)?.enabled
}
