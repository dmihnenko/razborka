import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getNpSettings, type PartsNpSettings } from '@/services/npSettingsService'
import { setNpApiKey } from '@/utils/npApiKey'
import { setNpConfig } from '@/utils/npConfig'

// ============================================================================
// Гидрация настроек Новой Почты из БД (parts_np_settings) в localStorage.
// Так ключ и профиль отправителя — общие для всех сотрудников разборки, а
// существующий npService (читает localStorage) работает без изменений.
// ============================================================================

export function useHydrateNpSettings(partsCompanyId?: string): PartsNpSettings | null {
  const { data } = useQuery({
    queryKey: ['np-settings', partsCompanyId],
    queryFn: () => getNpSettings(partsCompanyId!),
    enabled: !!partsCompanyId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!data) return
    if (data.api_key) setNpApiKey(data.api_key)
    setNpConfig({
      senderCityRef: data.sender_city_ref ?? '',
      senderCityName: data.sender_city_name ?? '',
      senderWarehouseRef: data.sender_warehouse_ref ?? '',
      senderWarehouseName: data.sender_warehouse_name ?? '',
      senderPhone: data.sender_phone ?? '',
      senderName: data.sender_name ?? '',
    })
  }, [data])

  return data ?? null
}
