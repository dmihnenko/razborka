import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type AppDesign = 'classic' | 'new'

const DESIGN_CLASSES = ['design-classic', 'design-new'] as const
const DESIGN_FONT_LINK_ID = 'ds-v2-font'
const LS_DESIGN_KEY = 'app-design'

function applyDesign(design: AppDesign) {
  const html = document.documentElement
  DESIGN_CLASSES.forEach(c => html.classList.remove(c))
  html.classList.add(`design-${design}`)
  // Cache for FOUC prevention on next load
  try { localStorage.setItem(LS_DESIGN_KEY, design) } catch {}

  // Load Plus Jakarta Sans only when new design is active
  if (design === 'new') {
    if (!document.getElementById(DESIGN_FONT_LINK_ID)) {
      const link = document.createElement('link')
      link.id = DESIGN_FONT_LINK_ID
      link.rel = 'stylesheet'
      link.href =
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
      document.head.appendChild(link)
    }
  }
}

export async function getGlobalDesign(): Promise<AppDesign> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'design')
      .single()
    return (data?.value as AppDesign) || 'classic'
  } catch {
    return 'classic'
  }
}

export async function setGlobalDesign(design: AppDesign): Promise<void> {
  await supabase
    .from('app_settings')
    .upsert(
      { key: 'design', value: design, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
}

export function useDesignSystem() {
  const [design, setDesignState] = useState<AppDesign>(() => {
    // Use localStorage cache for instant initial value (no FOUC)
    try {
      const cached = localStorage.getItem(LS_DESIGN_KEY) as AppDesign
      if (cached === 'classic' || cached === 'new') return cached
    } catch {}
    return 'classic'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load current design from Supabase on mount
    getGlobalDesign().then(d => {
      setDesignState(d)
      applyDesign(d)
      setLoading(false)
    })

    // Real-time subscription — all connected users get the update when admin changes
    const channel = supabase
      .channel('global_design_setting')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.design',
        },
        (payload: any) => {
          const next = (payload.new?.value as AppDesign) || 'classic'
          setDesignState(next)
          applyDesign(next)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const setDesign = useCallback(async (next: AppDesign) => {
    setDesignState(next)
    applyDesign(next)
    await setGlobalDesign(next)
  }, [])

  return { design, setDesign, loading }
}
