import { useState, useEffect, useRef } from 'react'
import {
  Save, CheckCircle,
  Key, ExternalLink, Tag, Warehouse, ChevronRight, Trash2,
  Phone, Send, Truck, MapPin, X, DollarSign,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { PHOTO_SERVICES, getCompanyPhotoStorage, saveCompanyPhotoStorage, isProviderConfigured, type PhotoStorageConfig, type PhotoProvider } from '@/services/photoStorageConfig'
import { getNpApiKey, setNpApiKey } from '@/utils/npApiKey'
import { getNpConfig, setNpConfig, NpSenderConfig } from '@/utils/npConfig'
import { upsertNpSettings } from '@/services/npSettingsService'
import { useHydrateNpSettings } from '@/hooks/useHydrateNpSettings'
import { searchCities, searchWarehouses, NpCity, NpWarehouse } from '@/services/npService'
import { toast } from 'sonner'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import { TELEGRAM_BOT_USERNAME, telegramConnectLink } from '@/config/telegram'

type PanelId = 'contacts' | 'rate' | 'imgbb' | 'np' | 'telegram'

// Строка parts_companies с полями, выбираемыми на этой странице (snake_case из БД).
interface CompanyContactsRow {
  name: string | null
  phone: string | null
  address: string | null
  city: string | null
  email: string | null
  telegram: string | null
  description: string | null
  telegram_chat_id: string | null
  ship_speed: string | null
  warranty_enabled: boolean | null
  warranty_days: number | null
}

const PANEL_TITLE_KEYS: Record<PanelId, string> = {
  contacts: 'settingsPage.panelContacts',
  rate: 'settingsPage.panelRate',
  imgbb: 'settingsPage.panelImgbb',
  np: 'settingsPage.panelNp',
  telegram: 'settingsPage.panelTelegram',
}

export default function PartsSettings() {
  const navigate = useNavigate()
  const { t } = useTranslation('cabinet')
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const [panel, setPanel] = useState<PanelId | null>(null)

  /* ── Курс доллара: авто (глобальный ПриватБанк) или свой курс разборки ── */
  const { rate, mode, manualRate, globalRate, date, isStale, setCompanyRate } = usePartsExchangeRate()
  const [rateMode, setRateMode] = useState<'auto' | 'manual'>(mode)
  const [manualInput, setManualInput] = useState<string>('')
  const [savingRate, setSavingRate] = useState(false)

  // Синхронизировать локальный выбор с эффективным режимом из хука при открытии панели
  useEffect(() => {
    if (panel === 'rate') {
      setRateMode(mode)
      setManualInput(manualRate != null ? String(manualRate) : (globalRate != null ? String(globalRate) : ''))
    }

  }, [panel])

  const handleSaveRate = async () => {
    setSavingRate(true)
    try {
      if (rateMode === 'manual') {
        const val = Number(manualInput.replace(',', '.'))
        if (!Number.isFinite(val) || val <= 0) {
          toast.error(t('settingsPage.toastInvalidRate'))
          return
        }
        await setCompanyRate('manual', val)
        toast.success(t('settingsPage.rateSavedManual', { rate: val }))
      } else {
        await setCompanyRate('auto')
        toast.success(t('settingsPage.rateSavedAuto'))
      }
      setPanel(null)
    } catch {
      toast.error(t('settingsPage.toastError'))
    } finally {
      setSavingRate(false)
    }
  }


  const [npKeyInput, setNpKeyInput] = useState<string>(getNpApiKey)

  /* ── Хранилище фото (per-company): провайдер + ключи ───────────── */
  const [photoCfg, setPhotoCfg] = useState<PhotoStorageConfig>({ provider: 'imgbb' })
  const [savingPhoto, setSavingPhoto] = useState(false)
  useEffect(() => {
    if (!partsCompanyId) return
    getCompanyPhotoStorage(partsCompanyId).then(cfg => { if (cfg) setPhotoCfg(cfg) })
  }, [partsCompanyId])

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
  const npDb = useHydrateNpSettings(partsCompanyId ?? undefined)
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
    toast.success(t('settingsPage.toastSenderSaved'))
  }

  /* ── Контакты разборки ────────────────────────────────────────── */
  const queryClient = useQueryClient()
  const { data: company } = useQuery({
    queryKey: ['parts_company_settings', partsCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_companies')
        .select('name, phone, address, city, email, telegram, description, telegram_chat_id, ship_speed, warranty_enabled, warranty_days')
        .eq('id', partsCompanyId)
        .single()
      return data as CompanyContactsRow | null
    },
    enabled: !!partsCompanyId,
  })

  const [contacts, setContacts] = useState({
    name: '', phone: '', address: '', city: '', email: '', telegram: '', description: '',
    shipSpeed: 'today', warrantyEnabled: true, warrantyDays: '14',
  })

  useEffect(() => {
    if (company) {
      setContacts({
        name: company.name || '',
        phone: company.phone || '',
        address: company.address || '',
        city: company.city || '',
        email: company.email || '',
        telegram: company.telegram || '',
        description: company.description || '',
        shipSpeed: company.ship_speed || 'today',
        warrantyEnabled: company.warranty_enabled ?? true,
        warrantyDays: String(company.warranty_days ?? 14),
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
          city: contacts.city.trim() || null,
          email: contacts.email.trim(),
          telegram: contacts.telegram.trim() || null,
          description: contacts.description.trim() || null,
          ship_speed: contacts.shipSpeed === 'days12' ? 'days12' : 'today',
          warranty_enabled: contacts.warrantyEnabled,
          warranty_days: Math.max(1, Number(contacts.warrantyDays) || 14),
        })
        .eq('id', partsCompanyId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts_company_settings'] })
      queryClient.invalidateQueries({ queryKey: ['company-contacts-check'] })
      toast.success(t('settingsPage.toastContactsSaved'))
    },
    onError: (e: unknown) => toast.error((e instanceof Error ? e.message : String(e)) || t('settingsPage.toastError')),
  })

  const contactsDirty = !!company && (
    contacts.name !== (company.name || '') ||
    contacts.phone !== (company.phone || '') ||
    contacts.address !== (company.address || '') ||
    contacts.city !== (company.city || '') ||
    contacts.email !== (company.email || '') ||
    contacts.telegram !== (company.telegram || '') ||
    contacts.description !== (company.description || '') ||
    contacts.shipSpeed !== (company.ship_speed || 'today') ||
    contacts.warrantyEnabled !== (company.warranty_enabled ?? true) ||
    contacts.warrantyDays !== String(company.warranty_days ?? 14)
  )

  // Чтение/запись поля выбранного провайдера в общий photoCfg
  const getProviderField = (field: 'key' | 'cloudName' | 'preset'): string => {
    const read = (obj: Record<string, string> | undefined) => obj?.[field] || ''
    if (photoCfg.provider === 'cloudinary') return read(photoCfg.cloudinary)
    if (photoCfg.provider === 'freeimage') return read(photoCfg.freeimage)
    return read(photoCfg.imgbb)
  }
  const setProviderField = (field: 'key' | 'cloudName' | 'preset', value: string) => {
    setPhotoCfg(c => {
      if (c.provider === 'cloudinary') return { ...c, cloudinary: { cloudName: '', preset: '', ...c.cloudinary, [field]: value } }
      if (c.provider === 'freeimage') return { ...c, freeimage: { key: '', ...c.freeimage, [field]: value } }
      return { ...c, imgbb: { key: '', ...c.imgbb, [field]: value } }
    })
  }

  const handleSavePhotoStorage = async () => {
    if (!partsCompanyId) return
    setSavingPhoto(true)
    try {
      await saveCompanyPhotoStorage(partsCompanyId, photoCfg)
      queryClient.invalidateQueries({ queryKey: ['parts-company-photo-storage', partsCompanyId] })
      toast.success(t('settingsPage.toastPhotoSaved'))
      setPanel(null) // закрываем панель после сохранения (как у Telegram и др.)
    } catch {
      toast.error(t('settingsPage.toastPhotoSaveError'))
    } finally {
      setSavingPhoto(false)
    }
  }

  const handleSaveNpKey = async () => {
    const trimmed = npKeyInput.trim()
    setNpApiKey(trimmed)
    if (partsCompanyId) {
      try { await upsertNpSettings(partsCompanyId, { api_key: trimmed || null }) }
      catch { /* localStorage уже сохранён */ }
    }
    toast.success(trimmed ? t('settingsPage.toastNpKeySaved') : t('settingsPage.toastNpKeyRemoved'))
  }

  if (!partsCompanyId) return <PartsAccessDenied />

  /* ── статусы интеграций ── */
  const imgbbConnected = isProviderConfigured(photoCfg)
  const npConnected = Boolean(npKeyInput.trim())
  const tgConnected = Boolean(company?.telegram_chat_id)

  const connectedBadge = { cls: 'cab-chip text-emerald-700 bg-emerald-50 border-emerald-200', text: t('settingsPage.badgeConnected') }
  const notSetBadge = { cls: 'cab-chip', text: t('settingsPage.badgeNotSet') }

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
      id: 'contacts', Icon: Phone, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-signal)]',
      title: t('settingsPage.cardContactsTitle'), sub: t('settingsPage.cardContactsSub'), onClick: () => setPanel('contacts'),
    },
    {
      id: 'rate', Icon: DollarSign, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-ink-2)]',
      title: t('settingsPage.cardRateTitle'),
      sub: `${rate ?? '—'} ₴/$ · ${mode === 'manual' ? t('settingsPage.sourceManual') : t('settingsPage.sourcePrivat')}`,
      badge: mode === 'manual'
        ? { cls: 'cab-chip', text: t('settingsPage.rateChipManual') }
        : (isStale
            ? { cls: 'cab-chip text-amber-700 bg-amber-50 border-amber-200', text: t('settingsPage.badgeUpdate') }
            : { cls: 'cab-chip text-emerald-700 bg-emerald-50 border-emerald-200', text: t('settingsPage.badgeToday') }),
      onClick: () => setPanel('rate'),
    },
    {
      id: 'imgbb', Icon: Key, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-ink-2)]',
      title: t('settingsPage.cardPhotoTitle'), sub: PHOTO_SERVICES.find(s => s.id === photoCfg.provider)?.name || t('settingsPage.cardPhotoSubFallback'), badge: imgbbConnected ? connectedBadge : notSetBadge,
      onClick: () => setPanel('imgbb'),
    },
    {
      id: 'np', Icon: Truck, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-ink-2)]',
      title: t('settingsPage.cardNpTitle'), sub: t('settingsPage.cardNpSub'), badge: npConnected ? connectedBadge : notSetBadge,
      onClick: () => setPanel('np'),
    },
    ...(TELEGRAM_BOT_USERNAME ? [{
      id: 'telegram', Icon: Send, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-signal)]',
      title: t('settingsPage.cardTelegramTitle'), sub: t('settingsPage.cardTelegramSub'), badge: tgConnected ? connectedBadge : notSetBadge,
      onClick: () => setPanel('telegram'),
    } as CardDef] : []),
    {
      id: 'categories', Icon: Tag, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-ink-2)]',
      title: t('settingsPage.cardCategoriesTitle'), sub: t('settingsPage.cardCategoriesSub'), onClick: () => navigate('/parts/categories'),
    },
    {
      id: 'warehouse', Icon: Warehouse, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-ink-2)]',
      title: t('settingsPage.cardWarehouseTitle'), sub: t('settingsPage.cardWarehouseSub'), onClick: () => navigate('/parts/warehouse'),
    },
    {
      id: 'trash', Icon: Trash2, iconBg: 'bg-[var(--cab-surface-2)]', iconColor: 'text-[var(--cab-ink-2)]',
      title: t('settingsPage.cardTrashTitle'), sub: t('settingsPage.cardTrashSub'), onClick: () => navigate('/parts/trash'),
    },
  ]

  /* ── Содержимое модалки выбранного раздела ── */
  const renderPanel = () => {
    switch (panel) {
      case 'contacts':
        return (
          <div className="space-y-3">
            <div>
              <label className="form-label">{t('settingsPage.fieldName')}</label>
              <input type="text" value={contacts.name} onChange={e => setContacts(p => ({ ...p, name: e.target.value }))} placeholder={t('settingsPage.fieldNamePlaceholder')} className="form-input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t('settingsPage.fieldPhone')}</label>
                <input type="tel" value={contacts.phone} onChange={e => setContacts(p => ({ ...p, phone: e.target.value }))} placeholder="+380 XX XXX-XX-XX" className="form-input" />
              </div>
              <div>
                <label className="form-label">{t('settingsPage.fieldEmail')}</label>
                <input type="email" value={contacts.email} onChange={e => setContacts(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="form-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t('settingsPage.fieldCity')}</label>
                <input type="text" value={contacts.city} onChange={e => setContacts(p => ({ ...p, city: e.target.value }))} placeholder={t('settingsPage.fieldCityPlaceholder')} className="form-input" />
                <p className="text-xs text-gray-500 mt-1">{t('settingsPage.fieldCityHint')}</p>
              </div>
              <div>
                <label className="form-label">{t('settingsPage.fieldAddress')}</label>
                <input type="text" value={contacts.address} onChange={e => setContacts(p => ({ ...p, address: e.target.value }))} placeholder={t('settingsPage.fieldAddressPlaceholder')} className="form-input" />
              </div>
            </div>
            <div>
              <label className="form-label">{t('settingsPage.fieldTelegram')}</label>
              <input type="text" value={contacts.telegram} onChange={e => setContacts(p => ({ ...p, telegram: e.target.value }))} placeholder={t('settingsPage.fieldTelegramPlaceholder')} className="form-input" />
              <p className="text-xs text-gray-500 mt-1">{t('settingsPage.fieldTelegramHint')}</p>
            </div>
            <div>
              <label className="form-label">{t('settingsPage.fieldDescription')} <span className="text-gray-400 font-normal ml-1">{t('settingsPage.fieldDescriptionNote')}</span></label>
              <textarea value={contacts.description} onChange={e => setContacts(p => ({ ...p, description: e.target.value }))} placeholder={t('settingsPage.fieldDescriptionPlaceholder')} rows={3} className="form-input resize-none" />
            </div>

            {/* Доставка и гарантия — видно покупателям на странице товара */}
            <div className="pt-3 mt-1 border-t border-gray-100 space-y-3">
              <p className="text-sm font-semibold text-gray-800">{t('settingsPage.deliveryWarranty')}</p>
              <div>
                <label className="form-label">{t('settingsPage.shipSpeed')}</label>
                <select value={contacts.shipSpeed} onChange={e => setContacts(p => ({ ...p, shipSpeed: e.target.value }))} className="form-select">
                  <option value="today">{t('settingsPage.shipToday')}</option>
                  <option value="days12">{t('settingsPage.shipDays12')}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">{t('settingsPage.shipSpeedHint')}</p>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={contacts.warrantyEnabled} onChange={e => setContacts(p => ({ ...p, warrantyEnabled: e.target.checked }))} className="w-4 h-4 accent-[var(--cab-signal)]" />
                <span className="text-sm text-gray-700">{t('settingsPage.warrantyShow')}</span>
              </label>
              {contacts.warrantyEnabled && (
                <div>
                  <label className="form-label">{t('settingsPage.warrantyDays')}</label>
                  <input type="number" min={1} max={365} value={contacts.warrantyDays} onChange={e => setContacts(p => ({ ...p, warrantyDays: e.target.value }))} className="form-input w-32" placeholder="14" />
                </div>
              )}
            </div>

            <button onClick={() => saveContactsMutation.mutate()} disabled={saveContactsMutation.isPending || !contactsDirty} className="cab-btn cab-btn-primary w-full">
              <Save className="w-4 h-4" /> {t('settingsPage.save')}
            </button>
          </div>
        )

      case 'rate':
        return (
          <div className="space-y-4">
            {/* Текущий эффективный курс */}
            <div className="rounded-xl bg-[var(--cab-surface-2)] p-3">
              <p className="text-2xl font-bold text-gray-900 tabular">{rate ?? '—'} <span className="text-base font-semibold text-gray-500">₴/$</span></p>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === 'manual'
                  ? t('settingsPage.rateModeManualHint')
                  : (date
                      ? t('settingsPage.rateModeAutoHint', { date })
                      : t('settingsPage.rateModeAutoHintNoDate'))}
              </p>
            </div>

            {/* Сегмент-переключатель: Авто / Свой */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRateMode('auto')}
                className={`cab-chip flex-1 justify-center cursor-pointer ${rateMode === 'auto' ? 'text-[var(--cab-signal)] bg-[var(--cab-signal-weak)] border-[var(--cab-signal)]' : ''}`}
              >
                {t('settingsPage.modePrivat')}
              </button>
              <button
                type="button"
                onClick={() => setRateMode('manual')}
                className={`cab-chip flex-1 justify-center cursor-pointer ${rateMode === 'manual' ? 'text-[var(--cab-signal)] bg-[var(--cab-signal-weak)] border-[var(--cab-signal)]' : ''}`}
              >
                {t('settingsPage.modeManual')}
              </button>
            </div>

            {rateMode === 'auto' ? (
              <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                <p className="text-sm font-semibold text-gray-800">
                  {t('settingsPage.rateAutoCurrent', { rate: globalRate ?? '—', date: date ?? '—' })}
                </p>
                <p className="text-xs text-gray-500">{t('settingsPage.rateAutoUpdates')}</p>
              </div>
            ) : (
              <div>
                <label className="form-label">{t('settingsPage.rateManualField')}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder={globalRate != null ? String(globalRate) : '41.5'}
                  className="form-input w-40 tabular"
                />
                <p className="text-xs text-gray-500 mt-1">{t('settingsPage.rateManualHint')}</p>
              </div>
            )}

            <button onClick={handleSaveRate} disabled={savingRate} className="cab-btn cab-btn-primary w-full disabled:opacity-60">
              <Save className="w-4 h-4" /> {savingRate ? t('settingsPage.saving') : t('settingsPage.save')}
            </button>
          </div>
        )

      case 'imgbb': {
        const svc = PHOTO_SERVICES.find(s => s.id === photoCfg.provider) ?? PHOTO_SERVICES[0]
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {t('settingsPage.photoIntro1')} <b>{t('settingsPage.photoIntroOwn')}</b> {t('settingsPage.photoIntro2')}
            </p>

            {/* Выбор сервиса — карточки с лимитами */}
            <div className="grid grid-cols-1 gap-2">
              {PHOTO_SERVICES.map(s => {
                const active = photoCfg.provider === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPhotoCfg(c => ({ ...c, provider: s.id as PhotoProvider }))}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${active ? 'border-[var(--cab-signal)] bg-[var(--cab-signal-weak)]' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-gray-900">{s.name}</span>
                      {active && <CheckCircle className="w-4 h-4 text-[var(--cab-signal)] flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.limits}</p>
                  </button>
                )
              })}
            </div>

            {/* Инструкция для выбранного сервиса */}
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">{t('settingsPage.howToConnect', { name: svc.name })}</p>
              <ol className="space-y-1 text-xs text-gray-600 list-decimal list-inside">
                {svc.steps.map((st, i) => <li key={i}>{st}</li>)}
              </ol>
              <a href={svc.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2">
                <ExternalLink className="w-3.5 h-3.5" /> {t('settingsPage.openService', { name: svc.name })}
              </a>
            </div>

            {/* Поля ключей выбранного сервиса */}
            <div className="space-y-2">
              {svc.fields.map(f => (
                <div key={f.key}>
                  <label className="form-label">{f.label}</label>
                  <input
                    type="text"
                    value={getProviderField(f.key)}
                    onChange={e => setProviderField(f.key, e.target.value)}
                    className="form-input font-mono"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <button onClick={handleSavePhotoStorage} disabled={savingPhoto} className="cab-btn cab-btn-primary w-full disabled:opacity-60">
                <Save className="w-4 h-4" /> {savingPhoto ? t('settingsPage.saving') : t('settingsPage.savePhotoStorage')}
              </button>
            </div>
          </div>
        )
      }

      case 'np':
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="text" value={npKeyInput} onChange={e => setNpKeyInput(e.target.value)} className="form-input flex-1 font-mono" placeholder={t('settingsPage.npKeyPlaceholder')} />
              <button onClick={handleSaveNpKey} className="cab-btn cab-btn-primary flex-shrink-0"><Save className="w-4 h-4" /> {t('settingsPage.save')}</button>
            </div>
            <a href="https://new.novaposhta.ua/dashboard/settings/developers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> {t('settingsPage.npGetKey')}
            </a>

            {npKeyInput && (
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-800">{t('settingsPage.sender')}</span>
                </div>

                <div>
                  <label className="form-label">{t('settingsPage.senderCity')}</label>
                  <NpSettingsCombobox
                    value={npCityInput}
                    onChange={(v) => { setNpCityInput(v); setShowNpCityList(true) }}
                    placeholder={t('settingsPage.cityPlaceholder')}
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
                  <label className="form-label">{t('settingsPage.senderWarehouse')}</label>
                  <NpSettingsCombobox
                    value={npWarehouseInput}
                    onChange={(v) => { setNpWarehouseInput(v); setShowNpWarehouseList(true) }}
                    placeholder={npCityRef ? t('settingsPage.warehousePlaceholder') : t('settingsPage.warehousePlaceholderNoCity')}
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
                  <label className="form-label">{t('settingsPage.senderPhone')}</label>
                  <input type="tel" value={npSender.senderPhone || ''} onChange={e => setNpSender(p => ({ ...p, senderPhone: e.target.value }))} placeholder="+380XXXXXXXXX" className="form-input" />
                </div>

                <div>
                  <label className="form-label">{t('settingsPage.senderName')}</label>
                  <input type="text" value={npSender.senderName || ''} onChange={e => setNpSender(p => ({ ...p, senderName: e.target.value }))} placeholder={t('settingsPage.senderNamePlaceholder')} className="form-input" />
                </div>

                <button onClick={handleSaveNpSender} className="cab-btn cab-btn-primary w-full"><Save className="w-4 h-4" /> {t('settingsPage.saveSender')}</button>
              </div>
            )}
          </div>
        )

      case 'telegram':
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t('settingsPage.telegramIntro')}</p>
            {tgConnected ? (
              <div className="flex items-center justify-between gap-2">
                <span className="cab-chip text-emerald-700 bg-emerald-50 border-emerald-200"><CheckCircle className="w-3.5 h-3.5" /> {t('settingsPage.telegramConnected')}</span>
                <a href={partsCompanyId ? telegramConnectLink(partsCompanyId) : '#'} target="_blank" rel="noopener noreferrer" className="cab-btn cab-btn-ghost cab-btn-sm">{t('settingsPage.telegramReconnect')}</a>
              </div>
            ) : (
              <a href={partsCompanyId ? telegramConnectLink(partsCompanyId) : '#'} target="_blank" rel="noopener noreferrer" className="cab-btn cab-btn-primary inline-flex w-full justify-center">
                <Send className="w-4 h-4" /> {t('settingsPage.telegramConnect')}
              </a>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader title={i18n.t('cabinet:pages.settings')} backPath="/parts/dashboard" height="sm" />

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
                <p className="text-sm font-bold text-gray-900 truncate">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{c.sub}</p>
              </div>
            </button>
          ))}
        </div>

      </div>

      {/* ── Модалка раздела (top-sheet) ── */}
      {panel && (
        <div className="modal-overlay">
          <div className="modal-sheet sm:max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="heading-3">{t(PANEL_TITLE_KEYS[panel])}</h2>
              <button type="button" onClick={() => setPanel(null)} className="btn-icon" aria-label={t('settingsPage.close')}><X className="w-5 h-5" /></button>
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
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {items.map(item => (
            <li key={item.value}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-[var(--cab-signal-weak)] transition-colors"
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
