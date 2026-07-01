import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, LogOut, Phone, MapPin, Building2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BRAND } from '@/config/brand'
import { toast } from 'sonner'
import { IMaskInput } from 'react-imask'

interface Props {
  profile: { id: string } | null | undefined
  onLogout: () => void
  onComplete: () => void
  existingCompanyId?: string
  existingCompanyName?: string
}

export default function OwnerSetupPage({ profile, onLogout, onComplete, existingCompanyId, existingCompanyName }: Props) {
  const queryClient = useQueryClient()

  const isUpdate = !!existingCompanyId

  const [companyName, setCompanyName] = useState(existingCompanyName || '')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')

  const setupMutation = useMutation({
    mutationFn: async () => {
      const digits = companyPhone.replace(/\D/g, '')
      if (digits.length < 10) throw new Error('Введите корректный номер телефона')
      if (!companyName.trim()) throw new Error('Введите название компании')

      const table = 'parts_companies'
      const field = 'parts_company_id'

      if (isUpdate && existingCompanyId) {
        // Обновляем существующую компанию
        const { error } = await supabase
          .from(table)
          .update({ name: companyName.trim(), phone: companyPhone, address: companyAddress || null })
          .eq('id', existingCompanyId)
        if (error) throw error
      } else {
        // Создаём новую компанию
        const { data: company, error: companyError } = await supabase
          .from(table)
          .insert({ name: companyName.trim(), phone: companyPhone, address: companyAddress || null, is_active: true })
          .select('id').single()
        if (companyError) throw companyError

        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ [field]: company.id })
          .eq('id', profile!.id)
        if (profileError) throw profileError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      localStorage.removeItem('tsp_profile_cache')
      toast.success('Компания создана!')
      onComplete()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const Icon = Package
  const label = 'авторазборки'
  const title = isUpdate ? 'Добавьте телефон ' + label : 'Настройка ' + label
  const color = 'text-orange-600 bg-orange-50'
  const accentColor = 'bg-orange-600 hover:bg-orange-700'

  return (
    <div className="min-h-dvh bg-[#F4F6FA] flex flex-col">
      {/* Хедер */}
      <header className="bg-white border-b border-gray-200/80 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Package className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-bold text-gray-900">{BRAND.name}</span>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors min-h-[44px]">
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
            <span>Выйти</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-lg mx-auto w-full pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">

        {/* Иконка и заголовок */}
        <div className="text-center mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm ${color}`}>
            <Icon className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{title}</h1>
          <p className="text-sm text-gray-500">
            Заполните данные компании — без этого работники не смогут найти вас при регистрации
          </p>
        </div>

        {/* Форма */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Данные компании</p>
              <p className="text-xs text-gray-400">Заполните перед началом работы</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Название авторазборки <span className="text-red-400 normal-case font-normal">*</span>
              </label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder='Авторазборка "Запчасти"'
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Телефон <span className="text-red-400 normal-case font-normal">*</span>
                <span className="text-gray-400 normal-case font-normal ml-1 text-[11px]">— по нему найдут вас работники</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                <IMaskInput
                  mask="+38 000 000 00 00"
                  value={companyPhone}
                  onAccept={v => setCompanyPhone(String(v))}
                  placeholder="+38 099 999 99 99"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Адрес</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                  placeholder="ул. Центральная, 15"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
              </div>
            </div>
          </div>
        </div>

        <button onClick={() => setupMutation.mutate()} disabled={!companyName.trim() || !companyPhone || setupMutation.isPending}
          className={`w-full mt-4 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40 transition-colors shadow-sm ${accentColor}`}>
          {setupMutation.isPending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Check className="w-4 h-4" strokeWidth={2} />}
          {setupMutation.isPending ? 'Сохранение...' : 'Сохранить и войти'}
        </button>

      </div>
    </div>
  )
}
