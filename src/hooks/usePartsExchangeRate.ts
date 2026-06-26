import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Глобальный курс USD разборки: один на всю платформу, обновляется КРОНом (Worker, 2×/сутки)
// и хранится в app_settings (key='usd_rate', публичное чтение). Пользователи только ЧИТАЮТ —
// никаких пользовательских запросов к ПриватБанку (анти-спам). localStorage — кэш для мгновенного
// рендера до ответа БД.

interface GlobalRate { rate: number; date: string; source: string }
const CACHE_KEY = 'parts_usd_rate_global'

function loadCache(): GlobalRate | null {
  try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null } catch { return null }
}

async function fetchGlobalRate(): Promise<GlobalRate | null> {
  const { data, error } = await supabase
    .from('app_settings').select('value').eq('key', 'usd_rate').maybeSingle()
  if (error || !data?.value) return null
  try { return JSON.parse((data as any).value) } catch { return null }
}

export function usePartsExchangeRate() {
  const { data } = useQuery({
    queryKey: ['global-usd-rate'],
    queryFn: fetchGlobalRate,
    staleTime: 30 * 60 * 1000,
    placeholderData: () => loadCache() ?? undefined,
  })

  useEffect(() => {
    if (data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* quota */ } }
  }, [data])

  const rate = data?.rate ?? undefined // НИКАКОГО хардкода 41 — только хранимый/свежий из БД
  const ready = rate != null
  const date = data?.date ?? null
  const source = data?.source ?? null
  const today = new Date().toISOString().slice(0, 10)
  const isStale = !date || date !== today

  return { rate, ready, date, source, isStale }
}
