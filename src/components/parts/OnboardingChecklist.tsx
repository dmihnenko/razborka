import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { createPartsCategoriesBulk } from '@/services/partsService'
import { getCompanyPhotoStorage, isProviderConfigured } from '@/services/photoStorageConfig'

const DEFAULT_CATEGORIES = [
  'Двигатель',
  'Коробка передач',
  'Подвеска',
  'Тормозная система',
  'Электрика',
  'Кузовные детали',
  'Оптика',
  'Салон',
  'Колёса и диски',
  'Система охлаждения',
]

interface Props {
  partsCompanyId: string
}

export default function OnboardingChecklist({ partsCompanyId }: Props) {
  const { t } = useTranslation('cabinet')
  const queryClient = useQueryClient()
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // 1. Категории
  const { data: categoriesCount = null } = useQuery({
    queryKey: ['onboarding-categories', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_categories')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 2. Авто
  const { data: vehiclesCount = null } = useQuery({
    queryKey: ['onboarding-vehicles', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 3. Запчасти
  const { data: inventoryCount = null } = useQuery({
    queryKey: ['onboarding-inventory', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_inventory')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 4. Контакты
  const { data: companyContacts = null } = useQuery({
    queryKey: ['onboarding-contacts', partsCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_companies')
        .select('phone, telegram, address, telegram_chat_id')
        .eq('id', partsCompanyId)
        .single()
      return data
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 5. Места хранения (стеллажи/полки)
  const { data: storageCount = null } = useQuery({
    queryKey: ['onboarding-storage', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_storage_locations')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 6. Хранилище фото — per-company конфиг (provider + ключи в parts_companies)
  const { data: photoCfg = null } = useQuery({
    queryKey: ['onboarding-photo-storage', partsCompanyId],
    queryFn: () => getCompanyPhotoStorage(partsCompanyId),
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })
  const hasPhoto = isProviderConfigured(photoCfg)

  // 7. Telegram-уведомления (бот привязан → telegram_chat_id)
  const hasTelegram = !!(companyContacts as any)?.telegram_chat_id

  const addCategoriesMutation = useMutation({
    mutationFn: () => createPartsCategoriesBulk(DEFAULT_CATEGORIES, partsCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-categories', partsCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('onboarding.toastCatsAdded'))
    },
    onError: () => {
      toast.error(t('onboarding.toastCatsError'))
    },
  })

  // Считаем статусы
  const loading =
    categoriesCount === null ||
    vehiclesCount === null ||
    inventoryCount === null ||
    companyContacts === null ||
    storageCount === null

  const hasCats = (categoriesCount ?? 0) >= 1
  const hasStorage = (storageCount ?? 0) >= 1
  const hasVehicles = (vehiclesCount ?? 0) >= 1
  const hasInventory = (inventoryCount ?? 0) >= 1
  const hasContacts =
    !!companyContacts?.phone &&
    !!(companyContacts?.telegram || companyContacts?.address)

  const doneCount = [hasCats, hasStorage, hasPhoto, hasVehicles, hasInventory, hasContacts, hasTelegram].filter(Boolean).length
  const total = 7
  const allDone = doneCount === total
  const progressPct = Math.round((doneCount / total) * 100)

  // Не показываем, если пользователь скрыл
  if (dismissed) return null

  // Если всё готово — показываем «Всё настроено» (можно скрыть)
  if (!loading && allDone) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-green-50 border border-green-200/70 animate-fade-in">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-green-700 flex-1">{t('onboarding.allDone')}</span>
        <button
          onClick={() => setDismissed(true)}
          aria-label={t('onboarding.hide')}
          className="p-1 rounded-lg hover:bg-green-100 transition-colors text-green-500"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  // Не показываем во время загрузки (предотвращаем «прыжок»)
  if (loading) return null

  return (
    <div className="cab-card overflow-hidden animate-fade-in" aria-label={t('onboarding.checklistAria')}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-sm font-bold text-gray-800">{t('onboarding.title')}</p>
            <span className="cab-chip">{t('onboarding.progress', { done: doneCount, total })}</span>
          </div>
          {/* Прогресс-бар */}
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('onboarding.expand') : t('onboarding.collapse')}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 flex-shrink-0"
        >
          {collapsed
            ? <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
            : <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
          }
        </button>
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="divide-y divide-gray-100" role="list">
          {/* 1. Категории */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasCats
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasCats ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {t('onboarding.step1Title')}
              </p>
              {!hasCats && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => addCategoriesMutation.mutate()}
                    disabled={addCategoriesMutation.isPending}
                    className="cab-btn cab-btn-primary cab-btn-sm"
                  >
                    {addCategoriesMutation.isPending ? t('onboarding.adding') : t('onboarding.addBasic')}
                  </button>
                  <Link
                    to="/parts/categories"
                    className="cab-btn cab-btn-secondary cab-btn-sm"
                  >
                    {t('onboarding.openCategories')}
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 2. Авто */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasVehicles
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasVehicles ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {t('onboarding.step2Title')}
              </p>
              {!hasVehicles && (
                <div className="mt-2">
                  <Link to="/parts/vehicles" className="cab-btn cab-btn-secondary cab-btn-sm">
                    {t('onboarding.addVehicle')}
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 3. Запчасти */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasInventory
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasInventory ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {t('onboarding.step3Title')}
              </p>
              {!hasInventory && (
                <div className="mt-2">
                  <Link to="/parts/inventory" className="cab-btn cab-btn-secondary cab-btn-sm">
                    {t('onboarding.openInventory')}
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 4. Контакты */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasContacts
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasContacts ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {t('onboarding.step4Title')}
              </p>
              {!hasContacts && (
                <div className="mt-2">
                  <Link to="/parts/settings" className="cab-btn cab-btn-secondary cab-btn-sm">
                    {t('onboarding.settings')}
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 5. Места хранения */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasStorage
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasStorage ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {t('onboarding.step5Title')}
              </p>
              {!hasStorage && (
                <>
                  <p className="text-xs text-gray-500 mt-0.5">{t('onboarding.step5Desc')}</p>
                  <div className="mt-2">
                    <Link to="/parts/warehouse" className="cab-btn cab-btn-secondary cab-btn-sm">
                      {t('onboarding.openWarehouse')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </li>

          {/* 6. Хранилище фото (per-company) */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasPhoto
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasPhoto ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {t('onboarding.step6Title')}
              </p>
              {!hasPhoto && (
                <>
                  <p className="text-xs text-gray-500 mt-0.5">{t('onboarding.step6Desc')}</p>
                  <div className="mt-2">
                    <Link to="/parts/settings" className="cab-btn cab-btn-secondary cab-btn-sm">
                      {t('onboarding.setupStorage')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </li>

          {/* 7. Telegram-уведомления */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasTelegram
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasTelegram ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {t('onboarding.step7Title')}
              </p>
              {!hasTelegram && (
                <>
                  <p className="text-xs text-gray-500 mt-0.5">{t('onboarding.step7Desc')}</p>
                  <div className="mt-2">
                    <Link to="/parts/settings" className="cab-btn cab-btn-secondary cab-btn-sm">
                      {t('onboarding.connectTelegram')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </li>
        </ul>
      )}
    </div>
  )
}
