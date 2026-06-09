import { useState, useEffect } from 'react'
import { RefreshCw, Save, DollarSign, AlertTriangle, CheckCircle, Key, ExternalLink, Tag, Warehouse, ChevronRight, Trash2, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getImgbbKey, setImgbbKey } from '@/utils/imgbbKey'
import { toast } from 'sonner'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
export default function PartsSettings() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const {
    rate,
    date,
    source,
    isStale,
    fetching,
    fetchError,
    fetchPrivatBank,
    setManualRate,
  } = usePartsExchangeRate()

  const [manualInput, setManualInput] = useState<string>(String(rate))
  const [imgbbKeyInput, setImgbbKeyInput] = useState<string>(getImgbbKey)

  // Контакты разборки
  const queryClient = useQueryClient()
  const { data: company } = useQuery({
    queryKey: ['parts_company_settings', partsCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from('parts_companies').select('name, phone, address, email').eq('id', partsCompanyId).single()
      return data
    },
    enabled: !!partsCompanyId,
  })
  const [contacts, setContacts] = useState({ name: '', phone: '', address: '', email: '' })
  useEffect(() => {
    if (company) setContacts({ name: company.name || '', phone: company.phone || '', address: company.address || '', email: company.email || '' })
  }, [company])
  const saveContactsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('parts_companies')
        .update({ name: contacts.name.trim(), phone: contacts.phone.trim(), address: contacts.address.trim(), email: contacts.email.trim() })
        .eq('id', partsCompanyId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts_company_settings'] })
      queryClient.invalidateQueries({ queryKey: ['company-contacts-check'] })
      toast.success('Контакты сохранены')
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })
  const contactsDirty = !!company && (
    contacts.name !== (company.name || '') || contacts.phone !== (company.phone || '') ||
    contacts.address !== (company.address || '') || contacts.email !== (company.email || '')
  )

  const handleSaveImgbbKey = () => {
    const trimmed = imgbbKeyInput.trim()
    setImgbbKey(trimmed)
    toast.success(trimmed ? 'API ключ ImgBB сохранён' : 'API ключ удалён')
  }

  const handleFetchPrivatBank = async () => {
    try {
      const fetched = await fetchPrivatBank()
      setManualInput(String(fetched))
      toast.success(`Курс ПриватБанка получен: ${fetched} ₴/$`)
    } catch {
      toast.error(fetchError || 'Не удалось получить курс')
    }
  }

  const handleSaveManual = () => {
    const val = parseFloat(manualInput.replace(',', '.'))
    if (!val || val <= 0) {
      toast.error('Введите корректный курс')
      return
    }
    setManualRate(val)
    toast.success(`Курс установлен: ${val} ₴/$`)
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title="Настройки разборки"
        backPath="/parts/dashboard"
        height="sm"
      />

      <div className="w-full py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

          {/* Левая колонка */}
          <div className="space-y-4 sm:space-y-6">

            {/* Контакты разборки */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
                  <Phone className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Контакты разборки</h2>
                  <p className="text-xs text-gray-500">Название, телефон и адрес для клиентов и документов</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <input type="text" value={contacts.name} onChange={e => setContacts(p => ({ ...p, name: e.target.value }))}
                  placeholder="Название разборки" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input type="tel" value={contacts.phone} onChange={e => setContacts(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+380 XX XXX-XX-XX" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                  <input type="email" value={contacts.email} onChange={e => setContacts(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                </div>
                <input type="text" value={contacts.address} onChange={e => setContacts(p => ({ ...p, address: e.target.value }))}
                  placeholder="Адрес" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                <button onClick={() => saveContactsMutation.mutate()} disabled={saveContactsMutation.isPending || !contactsDirty}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-1.5 transition-colors text-sm disabled:opacity-50">
                  <Save className="w-4 h-4" /> Сохранить контакты
                </button>
              </div>
            </div>

            {/* Каталог */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Каталог</h2>
              </div>
              <button
                onClick={() => navigate('/parts/categories')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                  <Tag className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">Категории запчастей</p>
                  <p className="text-xs text-gray-500">Управление категориями и шаблонами</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
              <button
                onClick={() => navigate('/parts/warehouse')}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                  <Warehouse className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">Места хранения</p>
                  <p className="text-xs text-gray-500">Стеллажи, полки, ячейки склада</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            </div>

            {/* ImgBB API ключ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <Key className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">ImgBB API ключ</h2>
                  <p className="text-xs text-gray-500">Нужен для хранения фотографий запчастей</p>
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={imgbbKeyInput}
                  onChange={e => setImgbbKeyInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  placeholder="Вставьте ключ API..."
                />
                <button
                  onClick={handleSaveImgbbKey}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-1.5 transition-colors text-sm"
                >
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
              </div>
              {imgbbKeyInput && (
                <p className="text-xs text-green-600">✓ Ключ установлен</p>
              )}
              <a
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mt-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Получить бесплатный ключ на imgbb.com
              </a>
            </div>

            {/* Корзина */}
            <button
              onClick={() => navigate('/parts/trash')}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full"
            >
              <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">Корзина</p>
                  <p className="text-xs text-gray-500">Удалённые объекты хранятся 7 дней</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </button>

          </div>

          {/* Правая колонка — курс доллара */}
          <div className="space-y-4 sm:space-y-6">

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Курс доллара по умолчанию</h2>
                  <p className="text-xs text-gray-500">
                    Используется для расчёта доходности при продаже запчастей в гривне
                  </p>
                </div>
              </div>

              {/* Текущий курс */}
              <div className={`mb-3 p-3 rounded-lg border flex items-start gap-2 ${
                isStale ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
              }`}>
                {isStale ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    Текущий курс: <span className="text-base font-bold">{rate} ₴/$</span>
                  </p>
                  {date && (
                    <p className="text-xs text-gray-500">
                      {isStale
                        ? `Установлен ${formatDate(date)} (вчерашний курс — используется до обновления)`
                        : `Установлен сегодня ${formatDate(date)} · ${source === 'privatbank' ? 'ПриватБанк' : 'вручную'}`
                      }
                    </p>
                  )}
                  {!date && (
                    <p className="text-xs text-gray-500">Курс по умолчанию — обновите для точных расчётов</p>
                  )}
                </div>
              </div>

              {/* Получить от ПриватБанка */}
              <div className="mb-3">
                <button
                  onClick={handleFetchPrivatBank}
                  disabled={fetching}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-medium transition-colors text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                  {fetching ? 'Получаем курс...' : 'Получить курс ПриватБанка'}
                </button>
                {fetchError && (
                  <p className="text-xs text-red-600 mt-1">{fetchError}</p>
                )}
                <p className="text-xs text-gray-400 mt-1 text-center">Курс продажи USD/UAH на сегодня</p>
              </div>

              {/* Разделитель */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">или установить вручную</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Ручная установка */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    min="1"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    placeholder="41.50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₴/$</span>
                </div>
                <button
                  onClick={handleSaveManual}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center gap-1.5 transition-colors text-sm"
                >
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
              </div>
            </div>

            {/* Подсказка */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              <p className="font-medium mb-1.5">Как работает курс:</p>
              <ul className="space-y-1 list-disc list-inside text-xs text-blue-600">
                <li>Если запчасть продана в гривне — доход в $ считается по этому курсу</li>
                <li>Каждый автомобиль может иметь свой курс (указывается при редактировании авто)</li>
                <li>Если курс не обновлялся сегодня — используется последний установленный</li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
