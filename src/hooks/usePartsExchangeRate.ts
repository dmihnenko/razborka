import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsUsdRate, setPartsUsdRate, type PartsUsdRate } from '@/services/companyService'

// Курс USD разборки хранится в БД (parts_companies) — общий для команды и устройств,
// переживает чистку данных браузера. localStorage используется только как кэш для
// мгновенного рендера до ответа БД (и оффлайн-фолбэк). Источник правды — БД.

const STORAGE_PREFIX = 'parts_exchange_rate'
const keyFor = (companyId?: string | null) => `${STORAGE_PREFIX}_${companyId || 'none'}`

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function loadCache(companyId?: string | null): PartsUsdRate | null {
  try {
    const raw = localStorage.getItem(keyFor(companyId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveCache(companyId: string | null | undefined, data: PartsUsdRate) {
  try { localStorage.setItem(keyFor(companyId), JSON.stringify(data)) } catch { /* quota */ }
}

export function usePartsExchangeRate() {
  const { data: profile } = useUserProfile()
  const companyId = profile?.parts_company_id ?? null
  const qc = useQueryClient()
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Читаем курс компании из БД; кэш localStorage — placeholderData (мгновенно, но БД всё равно
  // подтягивается и становится источником правды).
  const { data: dbRate } = useQuery({
    queryKey: ['parts-usd-rate', companyId],
    queryFn: () => getPartsUsdRate(companyId!),
    enabled: !!companyId,
    placeholderData: () => loadCache(companyId) ?? undefined,
    staleTime: 5 * 60 * 1000,
  })

  // Синхронизация кэша с БД + одноразовый перенос старого localStorage-курса в БД
  useEffect(() => {
    if (!dbRate || !companyId) return
    if (dbRate.rate != null) {
      saveCache(companyId, dbRate)
    } else {
      // В БД пусто, но в браузере есть ранее выставленный курс → переносим в БД (не теряем 45).
      const cached = loadCache(companyId)
      if (cached?.rate != null) {
        setPartsUsdRate(cached.rate, cached.source === 'privatbank' ? 'privatbank' : 'manual')
          .then(() => qc.invalidateQueries({ queryKey: ['parts-usd-rate', companyId] }))
          .catch(() => { /* перенос best-effort */ })
      }
    }
  }, [dbRate, companyId, qc])

  const effective = dbRate ?? loadCache(companyId)
  const today = todayStr()
  const rate = effective?.rate ?? 41 // дефолт только если в БД и кэше пусто
  const date = effective?.date ?? null
  const source = effective?.source ?? null
  // Устаревший, если курса нет вовсе или он за прошлый день (предлагаем обновить, но НЕ перетираем)
  const isStale = !date || date !== today

  const persist = useCallback(async (value: number, src: 'manual' | 'privatbank') => {
    const fresh: PartsUsdRate = { rate: value, date: today, source: src }
    saveCache(companyId, fresh) // мгновенно в кэш
    qc.setQueryData(['parts-usd-rate', companyId], fresh) // мгновенно в UI
    await setPartsUsdRate(value, src) // в БД (общий источник)
    qc.invalidateQueries({ queryKey: ['parts-usd-rate', companyId] })
  }, [companyId, today, qc])

  const setManualRate = useCallback((value: number) => persist(value, 'manual'), [persist])

  const fetchPrivatBank = useCallback(async () => {
    setFetching(true); setFetchError(null)
    try {
      const res = await fetch('/api/privatbank-rate')
      if (!res.ok) throw new Error('Ошибка сети')
      const list: Array<{ ccy: string; base_ccy: string; buy: string; sale: string }> = await res.json()
      const usd = list.find(i => i.ccy === 'USD' && i.base_ccy === 'UAH')
      if (!usd) throw new Error('USD не найден в ответе')
      const parsed = parseFloat(usd.sale)
      if (isNaN(parsed) || parsed <= 0) throw new Error('Некорректный курс')
      await persist(parsed, 'privatbank')
      return parsed
    } catch (e: any) {
      setFetchError(e?.message || 'Ошибка получения курса')
      throw e
    } finally {
      setFetching(false)
    }
  }, [persist])

  return { rate, date, source, isStale, fetching, fetchError, fetchPrivatBank, setManualRate }
}
