import { supabase } from '@/lib/supabase'

export interface FeatureFlag {
  key: string
  enabled: boolean
  label: string | null
  updated_at?: string
}

/** Все фиче-флаги (публичные — гейтят UI). */
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled, label')
    .order('key')
  if (error) throw error
  return (data || []) as FeatureFlag[]
}

/** Включить/выключить флаг (только админ — гарантирует RLS). */
export async function setFeatureFlag(key: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw error
}
