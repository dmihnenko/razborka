import { useState, useCallback } from 'react'

const STORAGE_KEY = 'parts_exchange_rate'

interface StoredRate {
  rate: number
  date: string // YYYY-MM-DD
  source: 'privatbank' | 'manual'
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function loadStored(): StoredRate | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStored(data: StoredRate) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function usePartsExchangeRate() {
  const [stored, setStored] = useState<StoredRate | null>(() => loadStored())
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const today = todayStr()
  // isStale is true when no rate is stored at all, or when it was saved on a previous day
  const isStale = !stored || stored.date !== today

  // Если нечего нет — дефолт 41
  const rate = stored?.rate ?? 41

  const setManualRate = useCallback((value: number) => {
    const data: StoredRate = { rate: value, date: today, source: 'manual' }
    saveStored(data)
    setStored(data)
  }, [today])

  const fetchPrivatBank = useCallback(async () => {
    setFetching(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/privatbank-rate')
      if (!res.ok) throw new Error('Ошибка сети')
      const list: Array<{ ccy: string; base_ccy: string; buy: string; sale: string }> = await res.json()
      const usd = list.find(i => i.ccy === 'USD' && i.base_ccy === 'UAH')
      if (!usd) throw new Error('USD не найден в ответе')
      const parsed = parseFloat(usd.sale)
      if (isNaN(parsed) || parsed <= 0) throw new Error('Некорректный курс')
      const data: StoredRate = { rate: parsed, date: today, source: 'privatbank' }
      saveStored(data)
      setStored(data)
      return parsed
    } catch (e: any) {
      setFetchError(e?.message || 'Ошибка получения курса')
      throw e
    } finally {
      setFetching(false)
    }
  }, [today])

  return {
    rate,
    date: stored?.date ?? null,
    source: stored?.source ?? null,
    isStale,
    fetching,
    fetchError,
    fetchPrivatBank,
    setManualRate,
  }
}
