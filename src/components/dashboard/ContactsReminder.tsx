import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  kind?: 'parts'
  companyId?: string | null
}

/**
 * Напоминание владельцу заполнить контакты компании (телефон/адрес),
 * если они пустые. Контакты используются в счетах и уведомлениях клиентам.
 */
export default function ContactsReminder({ companyId }: Props) {
  const settingsPath = '/parts/settings'
  const label = 'разборки'

  const { data } = useQuery({
    queryKey: ['company-contacts-check', 'parts_companies', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_companies')
        .select('phone, address')
        .eq('id', companyId)
        .single()
      return data
    },
    enabled: !!companyId,
    staleTime: 60_000,
  })

  if (!data) return null
  const missing: string[] = []
  if (!data.phone?.trim()) missing.push('телефон')
  if (!data.address?.trim()) missing.push('адрес')
  if (missing.length === 0) return null

  return (
    <Link
      to={settingsPath}
      className="block rounded-xl border border-amber-300 bg-amber-50 p-4 hover:bg-amber-100/70 transition-colors"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Заполните контакты {label}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Не указан{missing.length > 1 ? 'ы' : ''} {missing.join(' и ')}. Эти данные подставляются в счета и
            напоминания клиентам — заполните их в настройках.
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      </div>
    </Link>
  )
}
