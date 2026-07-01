import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getCompanyRate, setCompanyRate as setCompanyRateSvc } from '@/services/companyService'

// Курс USD кабинета. Эффективный курс = по выбору разборки:
//  • mode='auto'   → ГЛОБАЛЬНЫЙ курс из app_settings (обновляет крон 2×/сутки; анти-спам).
//  • mode='manual' → СВОЙ курс разборки (parts_companies.usd_rate).
// Пользователь НЕ дёргает ПриватБанк — авто-курс берётся из БД, свой — сохранённое значение.
// localStorage — кэш глобального курса для мгновенного рендера.

interface GlobalRate { rate: number; date: string; source: string }
const CACHE_KEY = 'parts_usd_rate_global'

function loadCache(): GlobalRate | null {
  try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
async function fetchGlobalRate(): Promise<GlobalRate | null> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'usd_rate').maybeSingle()
  const row = data as { value: string | null } | null
  if (error || !row?.value) return null
  try { return JSON.parse(row.value) } catch { return null }
}

export function usePartsExchangeRate() {
  const { data: profile } = useUserProfile()
  const companyId = profile?.parts_company_id ?? null
  const qc = useQueryClient()

  const { data: global } = useQuery({
    queryKey: ['global-usd-rate'],
    queryFn: fetchGlobalRate,
    staleTime: 30 * 60 * 1000,
    placeholderData: () => loadCache() ?? undefined,
  })
  useEffect(() => {
    if (global) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(global)) } catch { /* quota */ } }
  }, [global])

  const { data: company } = useQuery({
    queryKey: ['company-rate', companyId],
    queryFn: () => getCompanyRate(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  })

  const mode: 'auto' | 'manual' = company?.mode === 'manual' ? 'manual' : 'auto'
  const manualRate = company?.manualRate ?? null
  const globalRate = global?.rate ?? undefined
  // Эффективный курс: свой (если выбран и задан), иначе глобальный. Никакого хардкода 41.
  const rate = mode === 'manual' && manualRate != null ? manualRate : globalRate
  const ready = rate != null
  const date = global?.date ?? null
  const source: 'manual' | 'auto' = mode === 'manual' && manualRate != null ? 'manual' : 'auto'
  const today = new Date().toISOString().slice(0, 10)
  const isStale = mode === 'auto' && (!date || date !== today)

  const setCompanyRate = async (m: 'auto' | 'manual', r?: number) => {
    await setCompanyRateSvc(m, r)
    qc.invalidateQueries({ queryKey: ['company-rate', companyId] })
  }

  return { rate, ready, mode, manualRate, globalRate, date, source, isStale, setCompanyRate }
}
