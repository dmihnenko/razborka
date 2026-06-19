import { useState, useEffect, useRef } from 'react'
import {
  RefreshCw, Save, DollarSign, AlertTriangle, CheckCircle,
  Key, ExternalLink, Tag, Warehouse, ChevronRight, Trash2,
  Phone, Send, Info, Truck, MapPin, X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getImgbbKey, setImgbbKey } from '@/utils/imgbbKey'
import { getNpApiKey, setNpApiKey } from '@/utils/npApiKey'
import { getNpConfig, setNpConfig, NpSenderConfig } from '@/utils/npConfig'
import { upsertNpSettings } from '@/services/npSettingsService'
import { useHydrateNpSettings } from '@/hooks/useHydrateNpSettings'
import { searchCities, searchWarehouses, NpCity, NpWarehouse } from '@/services/npService'
import { toast } from 'sonner'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { TELEGRAM_BOT_USERNAME, telegramConnectLink } from '@/config/telegram'

type PanelId = 'contacts' | 'rate' | 'imgbb' | 'np' | 'telegram'

const PANEL_TITLES: Record<PanelId, string> = {
  contacts: 'Настройки разборки',
  rate: 'Курс доллара',
  imgbb: 'ImgBB',
  np: 'Новая почта',
  telegram: 'Telegram-уведомления',
}

export default function PartsSettings() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const [panel, setPanel] = useState<PanelId | null>(null)

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
  const [rateMode, setRateMode] = useState<'privat' | 'manual'>('privat')
  const [imgbbKeyInput, setImgbbKeyInput] = useState<string>(getImgbbKey)
  const [npKeyInput, setNpKeyInput] = useState<string>(getNpApiKey)

  /* ── НП: конфиг отправителя ──────────────────────────────────── */
  const [npSender, setNpSender] = useState<Partial<NpSenderConfig>>(() => getNpConfig())
  const [npCityInput, setNpCityInput] = useState(npSender.senderCityName || '')
  const [npCityRef, setNpCityRef] = useState(npSender.senderCityRef || '')
  const [npCityDebounced, setNpCityDebounced] = useState('')
  const [npWarehouseInput, setNpWarehouseInput] = useState(npSender.senderWarehouseName || '')
  const [npWarehouseDebounced, setNpWarehouseDebounced] = useState('')
  const [showNpCityList, setShowNpCityList] = useState(false)
  const [showNpWarehouseList, setShowNpWarehouseList] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setNpCityDebounced(npCityInput), 350)
    return () => clearTimeout(t)
  }, [npCityInput])

  useEffect(() => {
    const t = setTimeout(() => setNpWarehouseDebounced(npWarehouseInput), 350)
    return () => clearTimeout(t)
  }, [npWarehouseInput])

  const npKeyActive = Boolean(npKeyInput.trim())

  const { data: npSettingsCities = [] } = useQuery<NpCity[]>({
    queryKey: ['np-cities-settings', npCityDebounced],
    queryFn: () => searchCities(npCityDebounced),
    enabled: npKeyActive && npCityDebounced.length >= 2,
    staleTime: 60_000,
  })

  const { data: npSettingsWarehouses = [] } = useQuery<NpWarehouse[]>({
    queryKey: ['np-warehouses-settings', npCityRef, npWarehouseDebounced],
    queryFn: () => searchWarehouses(npCityRef, npWarehouseDebounced),
    enabled: npKeyActive && Boolean(npCityRef),
    staleTime: 60_000,
  })

  // Гидрация НП-настроек из БД → localStorage + форма (общие для всех сотрудников)
  const npDb = useHydrateNpSettings(partsCompanyId)
  useEffect(() => {
    if (!npDb) return
    if (npDb.api_key && !npKeyInput) setNpKeyInput(npDb.api_key)
    setNpSender(prev => ({
      senderCityRef: prev.senderCityRef || npDb.sender_city_ref || '',
      senderCityName: prev.senderCityName || npDb.sender_city_name || '',
      senderWarehouseRef: prev.senderWarehouseRef || npDb.sender_warehouse_ref || '',
      senderWarehouseName: prev.senderWarehouseName || npDb.sender_warehouse_name || '',
      senderPhone: prev.senderPhone || npDb.sender_phone || '',
      senderName: prev.senderName || npDb.sender_name || '',
    }))
     
  }, [npDb])

  const handleSaveNpSender = async () => {
    setNpConfig(npSender)
    if (partsCompanyId) {
      try {
        await upsertNpSettings(partsCompanyId, {
          sender_city_ref: npSender.senderCityRef ?? null,
          sender_city_name: npSender.senderCityName ?? null,
          sender_warehouse_ref: npSender.senderWarehouseRef ?? null,
          sender_warehouse_name: npSender.senderWarehouseName ?? null,
          sender_phone: npSender.senderPhone ?? null,
          sender_name: npSender.senderName ?? null,
        })
      } catch { /* БД-настройки опциональны; localStorage уже сохранён */ }
    }
    toast.success('Данные отправителя сохранены')
  }

  /* ── Контакты разборки ────────────────────────────────────────── */
  const queryClient = useQueryClient()
  const { data: company } = useQuery({
    queryKey: ['parts_company_settings', partsCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_companies')
        .select('name, phone, address, email, telegram, description, telegram_chat_id')
        .eq('id', partsCompanyId)
        .single()
      return data
    },
    enabled: !!partsCompanyId,
  })

  const [contacts, setContacts] = useState({
    name: '', phone: '', address: '', email: '', telegram: '', description: '',
  })

  useEffect(() => {
    if (company) {
      setContacts({
        name: company.name || '',
        phone: company.phone || '',
        address: company.address || '',
        email: company.email || '',
        telegram: (company as any).telegram || '',
        description: (company as any).description || '',
      })
    }
  }, [company])

  const saveContactsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('parts_companies')
        .update({
          name: contacts.name.trim(),
          phone: contacts.phone.trim(),
          address: contacts.address.trim(),
          email: contacts.email.trim(),
          telegram: contacts.telegram.trim() || null,
          description: contacts.description.trim() || null,
        })
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
    contacts.name !== (company.name || '') ||
    contacts.phone !== (company.phone || '') ||
    contacts.address !== (company.address || '') ||
    contacts.email !== (company.email || '') ||
    contacts.telegram !== ((company as any).telegram || '') ||
    contacts.description !== ((company as any).description || '')
  )

  const handleSaveImgbbKey = () => {
    const trimmed = imgbbKeyInput.trim()
    setImgbbKey(trimmed)
    toast.success(trimmed ? 'API ключ ImgBB сохранён' : 'API ключ удалён')
  }

  const handleSaveNpKey = async () => {
    const trimmed = npKeyInput.trim()
    setNpApiKey(trimmed)
    if (partsCompanyId) {
      try { await upsertNpSettings(partsCompanyId, { api_key: trimmed || null }) }
      catch { /* localStorage уже сохранён */ }
    }
    toast.success(trimmed ? 'API ключ Новой почты сохранён (для всех сотрудников)' : 'API ключ Новой почты удалён')
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

  if (!partsCompanyId) return <PartsAccessDenied />

  /* ── статусы интеграций ── */
  const imgbbConnected = Boolean(imgbbKeyInput.trim())
  const npConnected = Boolean(npKeyInput.trim())
  const tgConnected = Boolean((company as any)?.telegram_chat_id)

  const connectedBadge = { cls: 'badge badge-green', text: 'Подключено' }
  const notSetBadge = { cls: 'badge badge-gray', text: 'Не задан' }

  type CardDef = {
    id: string
    Icon: typeof Phone
    iconBg: string
    iconColor: string
    title: string
    sub: string
    badge?: { cls: string; text: string }
    onClick: () => void
  }

  const cards: CardDef[] = [
    {
      id: 'contacts', Icon: Phone, iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Настройки разборки', sub: 'Название, телефон, адрес, описание', onClick: () => setPanel('contacts'),
    },
    {
      id: 'rate', Icon: DollarSign, iconBg: 'bg-green-100 dark:bg-green-900/40', iconColor: 'text-green-600 dark:text-green-400',
      title: 'Курс доллара', sub: `${rate} ₴/$ · ${isStale ? 'требует обновления' : 'актуальный'}`,
      badge: isStale ? { cls: 'badge badge-yellow', text: 'Обновить' } : { cls: 'badge badge-green', text: 'Сегодня' },
      onClick: () => setPanel('rate'),
    },
    {
      id: 'imgbb', Icon: Key, iconBg: 'bg-purple-100 dark:bg-purple-900/40', iconColor: 'text-purple-600 dark:text-purple-400',
      title: 'ImgBB', sub: 'Хранение фотографий запчастей', badge: imgbbConnected ? connectedBadge : notSetBadge,
      onClick: () => setPanel('imgbb'),
    },
    {
      id: 'np', Icon: Truck, iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-400',
      title: 'Новая почта', sub: 'Города и отделения при доставке', badge: npConnected ? connectedBadge : notSetBadge,
      onClick: () => setPanel('np'),
    },
    ...(TELEGRAM_BOT_USERNAME ? [{
      id: 'telegram', Icon: Send, iconBg: 'bg-sky-100 dark:bg-sky-900/40', iconColor: 'text-sky-600 dark:text-sky-400',
      title: 'Telegram-уведомления', sub: 'Заявки с маркета и напоминания', badge: tgConnected ? connectedBadge : notSetBadge,
      onClick: () => setPanel('telegram'),
    } as CardDef] : []),
    {
      id: 'categories', Icon: Tag, iconBg: 'bg-orange-100 dark:bg-orange-900/40', iconColor: 'text-orange-600 dark:text-orange-400',
      title: 'Категории запчастей', sub: 'Категории и шаблоны', onClick: () => navigate('/parts/categories'),
    },
    {
      id: 'warehouse', Icon: Warehouse, iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-400',
      title: 'Места хранения', sub: 'Стеллажи, полки, ячейки склада', onClick: () => navigate('/parts/warehouse'),
    },
    {
      id: 'trash', Icon: Trash2, iconBg: 'bg-red-100 dark:bg-red-900/40', iconColor: 'text-red-600 dark:text-red-400',
      title: 'Корзина', sub: 'Удалённые объекты — 7 дней', onClick: () => navigate('/parts/trash'),
    },
  ]

  /* ── Содержимое модалки выбранного раздела ── */
  const renderPanel = () => {
    switch (panel) {
      case 'contacts':
        return (
          <div className="space-y-3">
            <div>
              <label className="form-label">Название разборки</label>
              <input type="text" value={contacts.name} onChange={e => setContacts(p => ({ ...p, name: e.target.value }))} placeholder="Название разборки" className="form-input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Телефон</label>
                <input type="tel" value={contacts.phone} onChange={e => setContacts(p => ({ ...p, phone: e.target.value }))} placeholder="+380 XX XXX-XX-XX" className="form-input" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={contacts.email} onChange={e => setContacts(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="form-input" />
              </div>
            </div>
            <div>
              <label className="form-label">Адрес</label>
              <input type="text" value={contacts.address} onChange={e => setContacts(p => ({ ...p, address: e.target.value }))} placeholder="Адрес" className="form-input" />
            </div>
            <div>
              <label className="form-label">Telegram-ссылка (для маркета)</label>
              <input type="text" value={contacts.telegram} onChange={e => setContacts(p => ({ ...p, telegram: e.target.value }))} placeholder="@username или https://t.me/..." className="form-input" />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Ссылка на канал или чат — видна покупателям</p>
            </div>
            <div>
              <label className="form-label">Описание разборки <span className="text-gray-400 font-normal ml-1">(видят покупатели)</span></label>
              <textarea value={contacts.description} onChange={e => setContacts(p => ({ ...p, description: e.target.value }))} placeholder="Кратко о разборке: специализация, регион, условия..." rows={3} className="form-input resize-none" />
            </div>
            <button onClick={() => saveContactsMutation.mutate()} disabled={saveContactsMutation.isPending || !contactsDirty} className="cab-btn cab-btn-primary w-full">
              <Save className="w-4 h-4" /> Сохранить контакты
            </button>
          </div>
        )

      case 'rate':
        return (
          <div>
            <div className={`alert mb-4 ${isStale ? 'alert-warning' : 'alert-success'}`}>
              {isStale ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="text-sm font-semibold">Текущий курс: <span className="tabular text-base font-bold">{rate} ₴/$</span></p>
                {date && (
                  <p className="text-xs mt-0.5 opacity-80">
                    {isStale ? `Установлен ${formatDate(date)} — вчерашний, до обновления` : `Сегодня ${formatDate(date)} · ${source === 'privatbank' ? 'ПриватБанк' : 'вручную'}`}
                  </p>
                )}
                {!date && <p className="text-xs mt-0.5 opacity-80">Курс по умолчанию — обновите для точных расчётов</p>}
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setRateMode('privat')} className={`chip${rateMode === 'privat' ? ' active' : ''}`}>ПриватБанк</button>
              <button type="button" onClick={() => setRateMode('manual')} className={`chip${rateMode === 'manual' ? ' active' : ''}`}>Вручную</button>
            </div>

            {rateMode === 'privat' ? (
              <div>
                <button onClick={handleFetchPrivatBank} disabled={fetching} className="cab-btn cab-btn-primary w-full">
                  <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                  {fetching ? 'Получаем курс...' : 'Получить курс ПриватБанка'}
                </button>
                {fetchError && <p className="form-error mt-1.5">{fetchError}</p>}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">Курс продажи USD/UAH на сегодня</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input type="number" value={manualInput} onChange={e => setManualInput(e.target.value)} min="1" step="0.01" className="form-input tabular pr-10" placeholder="41.50" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₴/$</span>
                </div>
                <button onClick={handleSaveManual} className="cab-btn cab-btn-primary flex-shrink-0"><Save className="w-4 h-4" /> Сохранить</button>
              </div>
            )}

            <details className="mt-3">
              <summary className="text-xs text-primary cursor-pointer select-none hover:underline inline-flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Как работает курс?
              </summary>
              <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-gray-500 dark:text-slate-400">
                <li>Если запчасть продана в гривне — доход в $ считается по этому курсу</li>
                <li>Каждый автомобиль может иметь свой курс (указывается при редактировании авто)</li>
                <li>Если курс не обновлялся сегодня — используется последний установленный</li>
              </ul>
            </details>
          </div>
        )

      case 'imgbb':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-slate-400">Ключ ImgBB используется для загрузки и хранения фотографий запчастей.</p>
            <div className="flex gap-2">
              <input type="text" value={imgbbKeyInput} onChange={e => setImgbbKeyInput(e.target.value)} className="form-input flex-1 font-mono" placeholder="Вставьте ключ API..." />
              <button onClick={handleSaveImgbbKey} className="cab-btn cab-btn-primary flex-shrink-0"><Save className="w-4 h-4" /> Сохранить</button>
            </div>
            <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Получить бесплатный ключ на imgbb.com
            </a>
          </div>
        )

      case 'np':
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="text" value={npKeyInput} onChange={e => setNpKeyInput(e.target.value)} className="form-input flex-1 font-mono" placeholder="Вставьте API-ключ Новой почты..." />
              <button onClick={handleSaveNpKey} className="cab-btn cab-btn-primary flex-shrink-0"><Save className="w-4 h-4" /> Сохранить</button>
            </div>
            <a href="https://new.novaposhta.ua/dashboard/settings/developers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Получить API-ключ в кабинете Новой почты
            </a>

            {npKeyInput && (
              <div className="pt-3 border-t border-gray-100 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">Отправитель</span>
                </div>

                <div>
                  <label className="form-label">Город отправления</label>
                  <NpSettingsCombobox
                    value={npCityInput}
                    onChange={(v) => { setNpCityInput(v); setShowNpCityList(true) }}
                    placeholder="Введіть місто..."
                    items={npSettingsCities.map(c => ({ value: c.ref, label: c.name }))}
                    open={showNpCityList}
                    onOpen={() => setShowNpCityList(true)}
                    onClose={() => setShowNpCityList(false)}
                    onSelect={(item) => {
                      setNpCityInput(item.label)
                      setNpCityRef(item.value)
                      setNpSender(p => ({ ...p, senderCityRef: item.value, senderCityName: item.label, senderWarehouseRef: '', senderWarehouseName: '' }))
                      setNpWarehouseInput('')
                      setShowNpCityList(false)
                    }}
                  />
                </div>

                <div>
                  <label className="form-label">Отделение отправителя</label>
                  <NpSettingsCombobox
                    value={npWarehouseInput}
                    onChange={(v) => { setNpWarehouseInput(v); setShowNpWarehouseList(true) }}
                    placeholder={npCityRef ? 'Введіть відділення...' : 'Спочатку оберіть місто'}
                    disabled={!npCityRef}
                    items={npSettingsWarehouses.map(w => ({ value: w.ref, label: w.description }))}
                    open={showNpWarehouseList}
                    onOpen={() => { if (npCityRef) setShowNpWarehouseList(true) }}
                    onClose={() => setShowNpWarehouseList(false)}
                    onSelect={(item) => {
                      setNpWarehouseInput(item.label)
                      setNpSender(p => ({ ...p, senderWarehouseRef: item.value, senderWarehouseName: item.label }))
                      setShowNpWarehouseList(false)
                    }}
                  />
                </div>

                <div>
                  <label className="form-label">Телефон отправителя</label>
                  <input type="tel" value={npSender.senderPhone || ''} onChange={e => setNpSender(p => ({ ...p, senderPhone: e.target.value }))} placeholder="+380XXXXXXXXX" className="form-input" />
                </div>

                <div>
                  <label className="form-label">Ім'я / контактна особа</label>
                  <input type="text" value={npSender.senderName || ''} onChange={e => setNpSender(p => ({ ...p, senderName: e.target.value }))} placeholder="Іванов Іван" className="form-input" />
                </div>

                <button onClick={handleSaveNpSender} className="cab-btn cab-btn-primary w-full"><Save className="w-4 h-4" /> Сохранить отправителя</button>
              </div>
            )}
          </div>
        )

      case 'telegram':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-slate-400">Бот пришлёт уведомления о заявках с маркета и напоминания прямо в Telegram.</p>
            {tgConnected ? (
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-green"><CheckCircle className="w-3.5 h-3.5" /> Уведомления подключены</span>
                <a href={partsCompanyId ? telegramConnectLink(partsCompanyId) : '#'} target="_blank" rel="noopener noreferrer" className="cab-btn cab-btn-ghost cab-btn-sm">Переподключить</a>
              </div>
            ) : (
              <a href={partsCompanyId ? telegramConnectLink(partsCompanyId) : '#'} target="_blank" rel="noopener noreferrer" className="cab-btn cab-btn-primary inline-flex w-full justify-center">
                <Send className="w-4 h-4" /> Подключить уведомления
              </a>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-950">
      <PartsPageHeader title="Настройки разборки" backPath="/parts/dashboard" height="sm" />

      <div className="page-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {cards.map(c => (
            <button
              key={c.id}
              onClick={c.onClick}
              className="cab-card cab-card-hover p-4 text-left flex flex-col gap-3 group"
            >
              <div className="flex items-center justify-between">
                <div className={`icon-tile ${c.iconBg}`}><c.Icon className={`w-5 h-5 ${c.iconColor}`} strokeWidth={1.5} /></div>
                {c.badge
                  ? <span className={`${c.badge.cls} flex-shrink-0`}>{c.badge.text}</span>
                  : <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{c.title}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{c.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Модалка раздела (top-sheet) ── */}
      {panel && (
        <div className="modal-overlay" onClick={() => setPanel(null)}>
          <div className="modal-sheet sm:max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="heading-3">{PANEL_TITLES[panel]}</h2>
              <button type="button" onClick={() => setPanel(null)} className="btn-icon" aria-label="Закрыть"><X className="w-5 h-5" /></button>
            </div>
            <div className="modal-body">{renderPanel()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   NpSettingsCombobox — комбобокс для поиска городов/отделений НП
══════════════════════════════════════════════════════════════════ */
interface NpSettingsComboboxItem {
  value: string
  label: string
}

interface NpSettingsComboboxProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  items: NpSettingsComboboxItem[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (item: NpSettingsComboboxItem) => void
}

function NpSettingsCombobox({
  value, onChange, placeholder, disabled,
  items, open, onOpen, onClose, onSelect,
}: NpSettingsComboboxProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="form-input w-full disabled:opacity-50 disabled:cursor-not-allowed"
        onChange={e => onChange(e.target.value)}
        onFocus={onOpen}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          {items.map(item => (
            <li key={item.value}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-slate-200 hover:bg-[var(--cab-signal-weak)] dark:hover:bg-slate-800 transition-colors"
                onMouseDown={e => { e.preventDefault(); onSelect(item) }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
