import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { Settings as SettingsIcon, Wrench, Trash2, ChevronRight, Palette, Check, Sun, Moon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'

export default function StoSettings() {
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()

  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Загружаем настройки СТО
  const { data: stoCompany, isLoading } = useQuery({
    queryKey: ['sto_company_settings', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data, error } = await supabase
        .from('sto_companies')
        .select('id, name, services_menu_enabled')
        .eq('id', profile.sto_company_id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id && isStoOwner,
  })

  // Переключение меню услуг для работников
  const toggleServicesMenuMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('sto_companies')
        .update({ services_menu_enabled: enabled })
        .eq('id', profile?.sto_company_id)
      if (error) throw error
    },
    onSuccess: () => {
      // Инвалидируем все связанные запросы
      queryClient.invalidateQueries({ queryKey: ['sto_company_settings'] })
      queryClient.invalidateQueries({ queryKey: ['sto_company'] })
      // Важно: сбрасываем кэш для всех компонентов, использующих настройки СТО
      queryClient.refetchQueries({ queryKey: ['sto_company'] })
      toast.success('Настройки обновлены')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при обновлении настроек')
    }
  })

  if (!isStoOwner) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center text-gray-500">
          Доступ запрещен. Только владелец СТО может управлять настройками.
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const servicesMenuEnabled = stoCompany?.services_menu_enabled ?? true

  return (
    <div className="container-mobile">
      <div className="mb-4 sm:mb-6">
        <h1 className="heading-mobile-1">Настройки СТО</h1>
        {stoCompany?.name && (
          <p className="text-mobile-sm text-gray-500 mt-1">{stoCompany.name}</p>
        )}
      </div>

      <div className="space-y-4">
        {/* ─── Theme Selector ──────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Palette className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Оформление интерфейса</h2>
              <p className="text-xs text-gray-500 mt-0.5">Выберите цветовую схему системы</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Light theme card */}
            <button
              onClick={() => setTheme('light')}
              className={`relative group rounded-xl border-2 p-1 transition-all overflow-hidden ${
                theme === 'light'
                  ? 'border-blue-500 shadow-md shadow-blue-500/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Preview */}
              <div className="rounded-lg overflow-hidden bg-gray-50 aspect-video relative">
                {/* Fake sidebar */}
                <div className="absolute left-0 top-0 bottom-0 w-[28%] bg-white border-r border-gray-200 flex flex-col gap-1 p-1.5">
                  <div className="w-4 h-4 rounded bg-blue-500 mb-1" />
                  {[80,60,70,55,65].map((w,i) => (
                    <div key={i} className="h-1.5 rounded-full bg-gray-200" style={{ width: `${w}%`, opacity: i===1 ? 1 : 0.5 }} />
                  ))}
                </div>
                {/* Fake content */}
                <div className="absolute left-[30%] right-0 top-0 p-1.5 flex flex-col gap-1">
                  <div className="h-2 w-12 bg-gray-900 rounded mb-1" />
                  <div className="grid grid-cols-2 gap-1">
                    {['bg-blue-100','bg-green-100','bg-orange-100','bg-purple-100'].map(c => (
                      <div key={c} className={`h-4 rounded-lg ${c} border border-gray-200`} />
                    ))}
                  </div>
                  <div className="h-6 rounded-lg bg-white border border-gray-200 mt-1" />
                </div>
              </div>
              {/* Label */}
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs font-semibold text-gray-700">Светлая</span>
                </div>
                {theme === 'light' && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <Check className="w-3 h-3" /> Активна
                  </span>
                )}
              </div>
            </button>

            {/* Dark theme card */}
            <button
              onClick={() => setTheme('dark')}
              className={`relative group rounded-xl border-2 p-1 transition-all overflow-hidden ${
                theme === 'dark'
                  ? 'border-blue-500 shadow-md shadow-blue-500/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Preview */}
              <div className="rounded-lg overflow-hidden aspect-video relative" style={{ background: '#080C14' }}>
                {/* Fake sidebar */}
                <div className="absolute left-0 top-0 bottom-0 w-[28%] flex flex-col gap-1 p-1.5" style={{ background: '#0F1729', borderRight: '1px solid #1E2A3B' }}>
                  <div className="w-4 h-4 rounded bg-blue-500 mb-1" />
                  {[80,60,70,55,65].map((w,i) => (
                    <div key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: i===1 ? '#2563EB' : '#1E2A3B', opacity: i===1 ? 1 : 0.7 }} />
                  ))}
                </div>
                {/* Fake content */}
                <div className="absolute left-[30%] right-0 top-0 p-1.5 flex flex-col gap-1">
                  <div className="h-2 w-12 rounded mb-1" style={{ background: '#F1F5F9' }} />
                  <div className="grid grid-cols-2 gap-1">
                    {['rgba(37,99,235,0.2)','rgba(22,163,74,0.2)','rgba(234,88,12,0.2)','rgba(124,58,237,0.2)'].map((c,i) => (
                      <div key={i} className="h-4 rounded-lg" style={{ background: c, border: '1px solid rgba(255,255,255,0.06)' }} />
                    ))}
                  </div>
                  <div className="h-6 rounded-lg mt-1" style={{ background: '#161B27', border: '1px solid rgba(255,255,255,0.07)' }} />
                </div>
              </div>
              {/* Label */}
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-gray-700">Тёмная</span>
                </div>
                {theme === 'dark' && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <Check className="w-3 h-3" /> Активна
                  </span>
                )}
              </div>
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Выбор сохраняется в браузере и применяется мгновенно.
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wrench className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-mobile-lg font-semibold text-gray-900">
                  Меню услуг для работников
                </h2>
              </div>
              <p className="text-mobile-sm text-gray-600 mb-4">
                Разрешить работникам использовать справочник услуг при создании заявок. 
                Когда выключено, работники не будут видеть кнопку "Добавить из справочника".
              </p>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleServicesMenuMutation.mutate(!servicesMenuEnabled)}
                  disabled={toggleServicesMenuMutation.isPending}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    servicesMenuEnabled ? 'bg-blue-700' : 'bg-gray-300'
                  } ${toggleServicesMenuMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      servicesMenuEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-mobile-base font-medium ${
                  servicesMenuEnabled ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {servicesMenuEnabled ? 'Включено' : 'Выключено'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Корзина */}
        <Link
          to="/sto/trash"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors"
        >
          <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-mobile-base font-semibold text-gray-900">Корзина</h2>
            <p className="text-mobile-sm text-gray-500 mt-0.5">
              Удалённые объекты хранятся 7 дней с возможностью восстановления
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </Link>

        {/* Информация */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <SettingsIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-mobile-sm text-blue-900">
              <p className="font-medium mb-1">Совет:</p>
              <p>
                Отключите меню услуг, если вы хотите, чтобы работники вводили услуги вручную 
                без использования готового справочника. Это может быть полезно для большей гибкости 
                при описании выполненных работ.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
