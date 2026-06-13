const STORAGE_KEY = 'tsp_np_config'

export interface NpSenderConfig {
  senderCityRef: string
  senderCityName: string
  senderWarehouseRef: string
  senderWarehouseName: string
  senderPhone: string
  senderName: string
}

export function getNpConfig(): Partial<NpSenderConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<NpSenderConfig>
  } catch {
    return {}
  }
}

export function setNpConfig(cfg: Partial<NpSenderConfig>): void {
  const merged = { ...getNpConfig(), ...cfg }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
}
