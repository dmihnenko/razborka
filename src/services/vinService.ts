export interface VinDecodeResult {
  make?: string
  model?: string
  year?: number
  engine?: string
  bodyClass?: string
  raw?: Record<string, string>
}

function toTitleCase(str: string): string {
  if (!str) return str
  return str
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase())
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const normalized = vin.trim().toUpperCase()

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(normalized)}?format=json`

  let data: any
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data = await res.json()
  } catch {
    throw new Error('Сервис VIN недоступен')
  }

  const result: Record<string, string> = data?.Results?.[0] ?? {}

  const make = result.Make?.trim()
  const model = result.Model?.trim()
  const yearRaw = result.ModelYear?.trim()
  const dispL = result.DisplacementL?.trim()
  const fuel = result.FuelTypePrimary?.trim()
  const bodyClass = result.BodyClass?.trim()
  const errorCode = result.ErrorCode?.trim()

  // считаем нераспознанным если нет ни марки ни модели
  if (!make && !model) {
    return {}
  }

  const year = yearRaw ? parseInt(yearRaw, 10) : undefined

  let engine: string | undefined
  if (dispL && fuel) {
    engine = `${parseFloat(dispL).toFixed(1)}L ${fuel}`
  } else if (dispL) {
    engine = `${parseFloat(dispL).toFixed(1)}L`
  } else if (fuel) {
    engine = fuel
  }

  return {
    make: make ? toTitleCase(make) : undefined,
    model: model ? toTitleCase(model) : undefined,
    year: year && !isNaN(year) ? year : undefined,
    engine: engine || undefined,
    bodyClass: bodyClass || undefined,
    raw: errorCode ? { ErrorCode: errorCode, ErrorText: result.ErrorText ?? '' } : undefined,
  }
}
