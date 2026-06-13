import { useState, useEffect } from 'react'
import { RefreshCw, Save, DollarSign, AlertTriangle, CheckCircle, Key, ExternalLink, Tag, Warehouse, ChevronRight, Trash2, Phone, Send, Info, Truck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getImgbbKey, setImgbbKey } from '@/utils/imgbbKey'
import { getNpApiKey, setNpApiKey } from '@/utils/npApiKey'
import { toast } from 'sonner'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { TELEGRAM_BOT_USERNAME, telegramConnectLink } from '@/config/telegram'

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
  const [npKeyInput, setNpKeyInput] = useState<string>(getNpApiKey)

  // Контакты разборки
  const queryClient = useQueryClient()
  const { data: company } = useQuery({
    queryKey: ['parts_company_settings', partsCompanyId],
    queryFn: async () => {
      const { data } = await supabase.from('parts_companies').select('name, phone, address, email, telegram, description, telegram_chat_id').eq('id', partsCompanyId).single()
      return data
    },
    enabled: !!partsCompanyId,
  })
  const [contacts, setContacts] = useState({ name: '', phone: '', address: '', email: '', telegram: '', description: '' })
  useEffect(() => {
    if (company) setContacts({ name: company.name || '', phone: company.phone || '', address: company.address || '', email: company.email || '', telegram: (company as any).telegram || '', description: (company as any).description || '' })
  }, [company])
  const saveContactsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('parts_companies')
        .update({ name: contacts.name.trim(), phone: contacts.phone.trim(), address: contacts.address.trim(), email: contacts.email.trim(), telegram: contacts.telegram.trim() || null, description: contacts.description.trim() || null })
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
    contacts.address !== (company.address || '') || contacts.email !== (company.email || '') ||
    contacts.telegram !== ((company as any).telegram || '') || contacts.description !== ((company as any).description || '')
  )

  const handleSaveImgbbKey = () => {
    const trimmed = imgbbKeyInput.trim()
    setImgbbKey(trimmed)
    toast.success(trimmed ? 'API ключ ImgBB сохранён' : 'API ключ удалён')
  }

  const handleSaveNpKey = () => {
    const trimmed = npKeyInput.trim()
    setNpApiKey(trimmed)
    toast.success(trimmed ? 'API ключ Новой почты сохранён' : 'API ключ Новой почты удалён')
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
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-950">
      <PartsPageHeader
        title="Настройки разборки"
        backPath="/parts/dashboard"
        height="sm"
      />

      <div className="page-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

          {/* ── Левая колонка ── */}
          <div className="space-y-4 sm:space-y-5">

            {/* Контакты разборки */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-tile bg-emerald-100 dark:bg-emerald-900/40">
                  <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="heading-3">Контакты разборки</h2>
                  <p className="kicker mt-0.5">Название, телефон и адрес</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="form-label">Название разборки</label>
                  <input
                    type="text"
                    value={contacts.name}
                    onChange={e => setContacts(p => ({ ...p, name: e.target.value }))}
                    placeholder="Название разборки"
                    className="form-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Телефон</label>
                    <input
                      type="tel"
                      value={contacts.phone}
                      onChange={e => setContacts(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+380 XX XXX-XX-XX"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      value={contacts.email}
                      onChange={e => setContacts(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Адрес</label>
                  <input
                    type="text"
                    value={contacts.address}
                    onChange={e => setContacts(p => ({ ...p, address: e.target.value }))}
                    placeholder="Адрес"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Telegram</label>
                  <input
                    type="text"
                    value={contacts.telegram}
                    onChange={e => setContacts(p => ({ ...p, telegram: e.target.value }))}
                    placeholder="@username или https://t.me/..."
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Описание разборки
                    <span className="text-gray-400 font-normal ml-1">(видят покупатели на маркете)</span>
                  </label>
                  <textarea
                    value={contacts.description}
                    onChange={e => setContacts(p => ({ ...p, description: e.target.value }))}
                    placeholder="Кратко о вашей разборке: специализация, регион, условия работы..."
                    rows={3}
                    className="form-input resize-none"
                  />
                </div>

                <div>
                  <button
                    onClick={() => saveContactsMutation.mutate()}
                    disabled={saveContactsMutation.isPending || !contactsDirty}
                    className="btn-primary"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить контакты
                  </button>
                </div>
              </div>
            </div>

            {/* Уведомления в Telegram */}
            {TELEGRAM_BOT_USERNAME && (
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="icon-tile bg-sky-100 dark:bg-sky-900/40">
                    <Send className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <h2 className="heading-3">Уведомления в Telegram</h2>
                    <p className="kicker mt-0.5">Заявки с маркета и напоминания</p>
                  </div>
                </div>

                {(company as any)?.telegram_chat_id ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge badge-green">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Уведомления подключены
                    </span>
                    <a
                      href={partsCompanyId ? telegramConnectLink(partsCompanyId) : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-sm"
                    >
                      Переподключить
                    </a>
                  </div>
                ) : (
                  <a
                    href={partsCompanyId ? telegramConnectLink(partsCompanyId) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex"
                  >
                    <Send className="w-4 h-4" />
                    Подключить уведомления
                  </a>
                )}
              </div>
            )}

            {/* Каталог — Категории и Склады */}
            <div className="card !p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
                <p className="kicker">Каталог</p>
              </div>
              <div className="panel-divided">
                <button
                  onClick={() => navigate('/parts/categories')}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="icon-tile-sm bg-orange-100 dark:bg-orange-900/40">
                    <Tag className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Категории запчастей</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Управление категориями и шаблонами</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
                <button
                  onClick={() => navigate('/parts/warehouse')}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="icon-tile-sm bg-indigo-100 dark:bg-indigo-900/40">
                    <Warehouse className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Места хранения</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Стеллажи, полки, ячейки склада</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              </div>
            </div>

            {/* ImgBB API ключ */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-tile bg-purple-100 dark:bg-purple-900/40">
                  <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="heading-3">ImgBB API ключ</h2>
                  <p className="kicker mt-0.5">Хранение фотографий запчастей</p>
                </div>
              </div>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={imgbbKeyInput}
                  onChange={e => setImgbbKeyInput(e.target.value)}
                  className="form-input flex-1 font-mono"
                  placeholder="Вставьте ключ API..."
                />
                <button onClick={handleSaveImgbbKey} className="btn-primary flex-shrink-0">
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
              </div>

              {imgbbKeyInput && (
                <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                  Ключ установлен
                </p>
              )}

              <a
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Получить бесплатный ключ на imgbb.com
              </a>
            </div>

            {/* Новая почта API ключ */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-tile bg-red-100 dark:bg-red-900/40">
                  <Truck className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="heading-3">Новая почта</h2>
                  <p className="kicker mt-0.5">Автокомплит міст і відділень при доставці</p>
                </div>
              </div>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={npKeyInput}
                  onChange={e => setNpKeyInput(e.target.value)}
                  className="form-input flex-1 font-mono"
                  placeholder="Вставьте API-ключ Новой почты..."
                />
                <button onClick={handleSaveNpKey} className="btn-primary flex-shrink-0">
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
              </div>

              {npKeyInput && (
                <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                  Ключ установлен
                </p>
              )}

              <a
                href="https://new.novaposhta.ua/dashboard/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Получить API-ключ в кабинете Новой почты
              </a>
            </div>

            {/* Корзина */}
            <div className="card !p-0 overflow-hidden">
              <button
                onClick={() => navigate('/parts/trash')}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="icon-tile-sm bg-red-100 dark:bg-red-900/40">
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Корзина</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Удалённые объекты хранятся 7 дней</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            </div>

          </div>

          {/* ── Правая колонка — курс доллара ── */}
          <div className="space-y-4 sm:space-y-5">

            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-tile bg-green-100 dark:bg-green-900/40">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="heading-3">Курс доллара по умолчанию</h2>
                  <p className="kicker mt-0.5">Расчёт доходности при продаже в гривне</p>
                </div>
              </div>

              {/* Текущий курс */}
              <div className={`alert mb-4 ${isStale ? 'alert-warning' : 'alert-success'}`}>
                {isStale ? (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    Текущий курс:{' '}
                    <span className="tabular text-base font-bold">{rate} ₴/$</span>
                  </p>
                  {date && (
                    <p className="text-xs mt-0.5 opacity-80">
                      {isStale
                        ? `Установлен ${formatDate(date)} — вчерашний, используется до обновления`
                        : `Сегодня ${formatDate(date)} · ${source === 'privatbank' ? 'ПриватБанк' : 'вручную'}`
                      }
                    </p>
                  )}
                  {!date && (
                    <p className="text-xs mt-0.5 opacity-80">Курс по умолчанию — обновите для точных расчётов</p>
                  )}
                </div>
              </div>

              {/* Получить от ПриватБанка */}
              <div className="mb-4">
                <button
                  onClick={handleFetchPrivatBank}
                  disabled={fetching}
                  className="btn-primary w-full sm:w-auto"
                >
                  <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                  {fetching ? 'Получаем курс...' : 'Получить курс ПриватБанка'}
                </button>
                {fetchError && (
                  <p className="form-error mt-1.5">{fetchError}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                  Курс продажи USD/UAH на сегодня
                </p>
              </div>

              {/* Разделитель */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                <span className="kicker">или установить вручную</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
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
                    className="form-input tabular pr-10"
                    placeholder="41.50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₴/$</span>
                </div>
                <button onClick={handleSaveManual} className="btn-primary flex-shrink-0">
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
              </div>
            </div>

            {/* Подсказка */}
            <div className="alert alert-info">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Как работает курс</p>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li>Если запчасть продана в гривне — доход в $ считается по этому курсу</li>
                  <li>Каждый автомобиль может иметь свой курс (указывается при редактировании авто)</li>
                  <li>Если курс не обновлялся сегодня — используется последний установленный</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
