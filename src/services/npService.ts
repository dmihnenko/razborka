import { getNpApiKey } from '@/utils/npApiKey'

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/'

interface NpResponse<T = unknown> {
  success: boolean
  errors: string[]
  data: T[]
}

async function npRequest<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, string>
): Promise<T[]> {
  const apiKey = getNpApiKey()
  if (!apiKey) {
    throw new Error('Укажите API-ключ Новой почты в настройках')
  }

  const res = await fetch(NP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  })

  if (!res.ok) {
    throw new Error(`Ошибка сети: ${res.status}`)
  }

  const json: NpResponse<T> = await res.json()

  if (!json.success) {
    throw new Error(json.errors?.[0] || 'Ошибка API Новой почты')
  }

  return json.data
}

/* ─── Типы ────────────────────────────────────────────────────────── */

export interface NpCity {
  ref: string
  name: string
  area?: string
}

export interface NpWarehouse {
  ref: string
  description: string
}

/* ─── Адрес-запись из searchSettlements ─── */
interface NpSettlementAddress {
  Present: string
  DeliveryCity: string
}

interface NpSettlementGroup {
  Addresses: NpSettlementAddress[]
}

/* ─── Отделение из getWarehouses ─── */
interface NpWarehouseRaw {
  Ref: string
  Description: string
}

/* ─── API-функции ─────────────────────────────────────────────────── */

/**
 * Поиск населённых пунктов по строке.
 * Возвращает [] при q < 2 символов.
 */
export async function searchCities(q: string): Promise<NpCity[]> {
  if (q.length < 2) return []

  const data = await npRequest<NpSettlementGroup>(
    'Address',
    'searchSettlements',
    { CityName: q, Limit: '20' }
  )

  const group = data[0]
  if (!group || !Array.isArray(group.Addresses)) return []

  return group.Addresses.map((a) => ({
    ref: a.DeliveryCity,
    name: a.Present,
  }))
}

/**
 * Список отделений НП в указанном городе (опционально с фильтром по строке).
 */
export async function searchWarehouses(
  cityRef: string,
  q?: string
): Promise<NpWarehouse[]> {
  const data = await npRequest<NpWarehouseRaw>(
    'Address',
    'getWarehouses',
    { CityRef: cityRef, FindByString: q || '', Limit: '50' }
  )

  return data.map((w) => ({
    ref: w.Ref,
    description: w.Description,
  }))
}
