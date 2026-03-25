import Layout from './Layout'
import NewLayout from './NewLayout'
import { useDesignSystem } from '@/hooks/useDesignSystem'

/**
 * Switches between Classic and Precision Pro layouts based on the
 * global design setting (admin-controlled via Supabase, realtime).
 */
export default function LayoutSwitcher() {
  const { design } = useDesignSystem()
  return design === 'new' ? <NewLayout /> : <Layout />
}
