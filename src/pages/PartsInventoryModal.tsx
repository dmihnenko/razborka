// Форма добавления/редактирования запчасти (PartsInventoryModal) — вынесена из
// PartsInventory.tsx (god-компонент). Рендерится страницей в PartsInventoryEdit
// (asPage). Общие хелперы (buildLocationOptions, типы дропдаунов) — в ./PartsInventory.
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAlert } from '@/components/CustomAlert'
import { useTranslation } from 'react-i18next'
import { intlLocale } from '@/i18n'
import { toast } from 'sonner'
import { Camera, X, Upload, Copy, Check, ChevronDown, Package, Plus, ClipboardList, ArrowLeft } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { getMarketSections, classifyMarketCategory, marketSectionName } from '@/services/partsService'
import { StorageLocationCascade } from '@/components/parts/StorageLocationCascade'
import { uploadPhoto, deletePhotosIfUnused, PhotoProviderNotConfigured, PhotoQuotaExceeded, PhotoStorageUnavailable, PhotoSessionExpired } from '@/services/photoStorage'
import { type PhotoStorageConfig } from '@/services/photoStorageConfig'
import type { ImgbbPhoto } from '@/services/imgbbService'
import type { PartsInventoryItem, CreatePartsInventoryInput, PartsInventoryStatus, StorageLocation } from '@/types/parts'
import { buildLocationOptions, newBulkRow, buildBulkInputs, bulkHasPending, type BulkRow, type VehicleDropdownRow, type CategoryDropdownRow } from './partsInventoryShared'

const MAX_PHOTOS = 5

const STATUS_KEYWORDS: Record<string, PartsInventoryStatus> = {
  // reserved
  'бронь': 'reserved', 'брон': 'reserved', 'резерв': 'reserved', 'reserved': 'reserved',
  'зарезервировано': 'reserved', 'зарез': 'reserved',
  // sold
  'продано': 'sold', 'продан': 'sold', 'sold': 'sold', '✅': 'sold', '✔': 'sold',
  'продано/бронь': 'sold',
  // damaged
  'повреждено': 'damaged', 'поврежден': 'damaged', 'damaged': 'damaged',
}

function parseStatusKeyword(raw: string): PartsInventoryStatus {
  const cleaned = raw.toLowerCase().replace(/[-_\s]+/g, ' ').trim()
  // direct match
  if (STATUS_KEYWORDS[cleaned]) return STATUS_KEYWORDS[cleaned]
  // partial match
  for (const [key, val] of Object.entries(STATUS_KEYWORDS)) {
    if (cleaned.includes(key)) return val
  }
  return 'available'
}

function parseBulkText(text: string): ModalBulkRow[] {
  return text
    .split('\n')
    .map(line => {
      const cols = line.split('\t')
      const name  = (cols[0] || '').trim()
      const price = (cols[1] || '').trim().replace(',', '.')
      const oem   = (cols[2] || '').trim()
      const stat  = (cols[3] || '').trim()
      const status: PartsInventoryStatus = stat ? parseStatusKeyword(stat) : 'available'
      return newBulkRow({ name, selling_price: price, part_number: oem, status })
    })
    .filter(r => r.name && !/^[-\s=]+$/.test(r.name))
}

// Module-level helper — used by both main component and modal
function getCategoriesForVehicle(vehicleId: string, vehicles: VehicleDropdownRow[], categories: CategoryDropdownRow[]) {
  const vehicle = vehicles.find(v => v.id === vehicleId)
  if (!vehicle) return categories
  const make = (vehicle.make || '').toLowerCase()
  const relevantCats = categories.filter((cat) =>
    !cat.brand || cat.brand.toLowerCase() === make
  )
  return relevantCats.length > 0 ? relevantCats : categories
}

// Modal Component
type ModalBulkRow = BulkRow

interface PartsInventoryModalProps {
  item: PartsInventoryItem | null
  categories: CategoryDropdownRow[]
  vehicles: VehicleDropdownRow[]
  storageLocations: StorageLocation[]
  onClose: () => void
  onSave: (data: CreatePartsInventoryInput, pendingPhotos?: Promise<ImgbbPhoto>[], keepOpen?: boolean, done?: (ok: boolean) => void) => void
  onSaveBulk?: (items: CreatePartsInventoryInput[]) => void
  isSaving?: boolean
  initialVehicleId?: string
  onVehicleChange?: (id: string) => void
  initialStorageLocationId?: string
  onStorageChange?: (id: string) => void
  photoCfg?: PhotoStorageConfig | null
  /** Рендер как полноценная страница (в маршруте), а не модальное окно. */
  asPage?: boolean
  /** Магазинная позиция (true) или запчасть разборки (false). Закупочная цена — только для магазина. */
  isShop?: boolean
  /** Открыть форму сразу в пакетном режиме (только для новой позиции). */
  initialBulk?: boolean
}

export function PartsInventoryModal({ item, categories, vehicles, storageLocations, onClose, onSave, onSaveBulk, isSaving, initialVehicleId, onVehicleChange, initialStorageLocationId, onStorageChange, photoCfg, asPage, isShop, initialBulk }: PartsInventoryModalProps) {
  const { t, i18n } = useTranslation('cabinet')
  const queryClient = useQueryClient()
  const { showAlert } = useAlert()
  const [bulkMode, setBulkMode] = useState(!item && !!initialBulk && !!onSaveBulk)
  const [showPasteArea, setShowPasteArea] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [bulkItems, setBulkItems] = useState<ModalBulkRow[]>(() => [newBulkRow()])
  const autoFilledVehicle = !item && !!initialVehicleId
  const autoFilledStorage = !item && !!initialStorageLocationId
  const [autoHintDismissed, setAutoHintDismissed] = useState(false)
  // «Дополнительно» (Вариант A) — по умолчанию всегда свёрнуто.
  const [showMore, setShowMore] = useState(false)
  // Мобилка: «Добавить фото» открывает лист с выбором «Загрузить» / «Сделать фото».
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false)
  const [oemCopied, setOemCopied] = useState(false)
  // Фокус на «Оригинальный номер» при открытии и после «Сохранить и добавить ещё».
  const oemInputRef = useRef<HTMLInputElement>(null)
  // nameInputRef — только чтобы вернуть фокус на «Название» при ошибке валидации.
  const nameInputRef = useRef<HTMLInputElement>(null)
  // «Поколение» формы: при сбросе (добавить ещё) увеличиваем, чтобы поздно
  // долетевшие коллбэки выгрузки фото от ПРЕДЫДУЩЕЙ позиции не попали в новую.
  const formGenRef = useRef(0)
  // Липкие валюта и состояние — запоминаем последний выбор на сессию (как авто/место).
  const stickyCurrency = (item?.price_currency as 'UAH' | 'USD')
    || (sessionStorage.getItem('parts_last_currency') as 'UAH' | 'USD' | null)
    || 'USD'
  const stickyCondition = item?.condition
    || sessionStorage.getItem('parts_last_condition')
    || 'used'
  const [bulkShared, setBulkShared] = useState({
    category_id: '',
    vehicle_id: initialVehicleId || '',
    condition: stickyCondition,
    storage_location_id: initialStorageLocationId || '',
    price_currency: stickyCurrency,
  })

  const [formData, setFormData] = useState<CreatePartsInventoryInput>({
    category_id: item?.category_id || '',
    vehicle_id: item?.vehicle_id || initialVehicleId || '',
    name: item?.name || '',
    part_number: item?.part_number || '',
    description: item?.description || '',
    condition: stickyCondition,
    quantity: item?.quantity || 1,
    selling_price: item?.selling_price || undefined,
    purchase_price: item?.purchase_price ?? undefined,
    price_currency: stickyCurrency,
    location: item?.location || '',
    shelf: item?.shelf || '',
    bin: item?.bin || '',
    notes: item?.notes || '',
    storage_location_id: item?.storage_location_id || initialStorageLocationId || '',
    market_category: item?.market_category ?? null,
    market_category_locked: item?.market_category_locked ?? false,
  })
  const [photos, setPhotos] = useState<ImgbbPhoto[]>((item?.photos as ImgbbPhoto[]) || [])
  // Фото, которые ещё грузятся в ФОНЕ: превью сразу (localUrl) + промис выгрузки.
  // Можно «Сохранить» не дожидаясь — оставшиеся промисы передаём в onSave,
  // родитель допишет их в товар после создания.
  const [pendingPhotos, setPendingPhotos] = useState<{ id: string; localUrl: string; promise: Promise<ImgbbPhoto> }[]>([])
  const uploading = pendingPhotos.length > 0
  // Загруженные в этой сессии формы, но ещё не сохранённые фото: при удалении/закрытии без
  // сохранения их надо убрать из хранилища (иначе сироты и «съеденная» квота).
  const sessionUploadsRef = useRef<Map<string, ImgbbPhoto>>(new Map())
  const pendingRef = useRef(pendingPhotos)
  pendingRef.current = pendingPhotos
  const submittedRef = useRef(false)
  // Фото пакетного режима: загруженные (url → фото) и грузящиеся промисы. Чистим при закрытии без сохранения.
  const bulkUploadsRef = useRef<Map<string, ImgbbPhoto>>(new Map())
  const bulkInFlightRef = useRef<Set<Promise<ImgbbPhoto>>>(new Set())
  const bulkSubmittedRef = useRef(false)
  useEffect(() => () => {
    if (!bulkSubmittedRef.current) {
      const bo = [...bulkUploadsRef.current.values()]
      if (bo.length) void deletePhotosIfUnused(bo).catch(() => {})
      for (const pr of bulkInFlightRef.current) pr.then(ph => deletePhotosIfUnused([ph])).catch(() => {})
    }
    if (submittedRef.current) return
    const orphans = [...sessionUploadsRef.current.values()]
    if (orphans.length) void deletePhotosIfUnused(orphans).catch(() => {})
    for (const p of pendingRef.current) p.promise.then(ph => deletePhotosIfUnused([ph])).catch(() => {})
  }, [])

  // Раздел на маркете: справочник + превью авторазметки (RPC с задержкой 400 мс после ввода названия).
  const { data: sections = [] } = useQuery({
    queryKey: ['market', 'sections'],
    queryFn: getMarketSections,
    staleTime: 30 * 60_000,
  })
  const [debouncedName, setDebouncedName] = useState(formData.name)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(formData.name), 400)
    return () => clearTimeout(timer)
  }, [formData.name])
  const { data: autoSlug = null } = useQuery({
    queryKey: ['market', 'classify', debouncedName.trim()],
    queryFn: () => classifyMarketCategory(debouncedName.trim()),
    enabled: debouncedName.trim().length > 1 && !bulkMode,
    staleTime: 10 * 60_000,
  })
  const autoSection = autoSlug ? sections.find(s => s.slug === autoSlug) : undefined
  const sectionMode = !formData.market_category_locked ? 'auto' : formData.market_category ?? 'none'
  const handleSectionChange = (v: string) => {
    if (v === 'auto') setFormData({ ...formData, market_category: item?.market_category ?? null, market_category_locked: false })
    else if (v === 'none') setFormData({ ...formData, market_category: null, market_category_locked: true })
    else setFormData({ ...formData, market_category: v, market_category_locked: true })
  }

  // Автофокус на «Оригинальный номер» при создании (single) — сразу печатать номер.
  useEffect(() => {
    if (!item && !bulkMode) oemInputRef.current?.focus()
  }, [item, bulkMode])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    let files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    // Лимит 5 фото на товар (учитываем загруженные + те, что в процессе)
    const used = photos.length + pendingPhotos.length
    const remaining = MAX_PHOTOS - used
    if (remaining <= 0) {
      toast.error(t('inventoryPage.maxPhotos', { max: MAX_PHOTOS }))
      return
    }
    if (files.length > remaining) {
      toast.error(t('inventoryPage.canAddMorePhotos', { remaining, max: MAX_PHOTOS }))
      files = files.slice(0, remaining)
    }

    // Конфиг хранилища ещё не загружен — не грузим молча «куда попало»
    if (!photoCfg) {
      toast.error(t('inventoryPage.photoConfigNotLoaded'))
      return
    }
    submittedRef.current = false

    // Превью мгновенно, выгрузка в ФОНЕ — пользователь не ждёт (можно сразу сохранять).
    const gen = formGenRef.current
    for (const file of files) {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
      const localUrl = URL.createObjectURL(file)
      const promise = uploadPhoto(file, photoCfg)
      setPendingPhotos(prev => [...prev, { id, localUrl, promise }])
      promise
        .then(uploaded => {
          // форму сбросили под новую позицию — это фото уже ушло в предыдущую (через
          // inFlight), в новую его добавлять нельзя.
          if (gen === formGenRef.current) {
            sessionUploadsRef.current.set(uploaded.url, uploaded)
            setPhotos(prev => [...prev, uploaded])
          }
        })
        .catch(err => {
          if (err instanceof PhotoSessionExpired) toast.error(t('inventoryPage.photoSessionExpired'))
          else if (err instanceof PhotoQuotaExceeded) showAlert(t('inventoryPage.photoQuotaExceeded'), 'error')
          else if (err instanceof PhotoStorageUnavailable) toast.error(t('inventoryPage.photoStorageUnavailable'))
          else if (err instanceof PhotoProviderNotConfigured) toast.error(err.message)
          else toast.error(t('inventoryPage.photoUploadError'))
        })
        .finally(() => {
          // счётчик «Фото X из Y» на складе и в подписке
          void queryClient.invalidateQueries({ queryKey: ['photo-usage'] })
          if (gen === formGenRef.current) setPendingPhotos(prev => prev.filter(p => p.id !== id))
          URL.revokeObjectURL(localUrl)
        })
    }
  }

  const patchBulkRow = (rowId: string, fn: (r: ModalBulkRow) => ModalBulkRow) =>
    setBulkItems(prev => prev.map(r => (r.id === rowId ? fn(r) : r)))

  const handleBulkPhotoSelect = (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    let files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const row = bulkItems.find(r => r.id === rowId)
    if (!row) return
    const remaining = MAX_PHOTOS - row.photos.length - row.pending.length
    if (remaining <= 0) {
      toast.error(t('inventoryPage.maxPhotos', { max: MAX_PHOTOS }))
      return
    }
    if (files.length > remaining) {
      toast.error(t('inventoryPage.canAddMorePhotos', { remaining, max: MAX_PHOTOS }))
      files = files.slice(0, remaining)
    }
    if (!photoCfg) {
      toast.error(t('inventoryPage.photoConfigNotLoaded'))
      return
    }
    bulkSubmittedRef.current = false
    for (const file of files) {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
      const localUrl = URL.createObjectURL(file)
      const promise = uploadPhoto(file, photoCfg)
      bulkInFlightRef.current.add(promise)
      patchBulkRow(rowId, r => ({ ...r, pending: [...r.pending, { id, localUrl }] }))
      promise
        .then(uploaded => {
          bulkUploadsRef.current.set(uploaded.url, uploaded)
          // строку могли удалить, пока фото грузилось — тогда чистим его сразу
          setBulkItems(prev => {
            if (!prev.some(r => r.id === rowId)) {
              bulkUploadsRef.current.delete(uploaded.url)
              void deletePhotosIfUnused([uploaded]).catch(() => {})
              return prev
            }
            return prev.map(r => (r.id === rowId ? { ...r, photos: [...r.photos, uploaded] } : r))
          })
        })
        .catch(err => {
          if (err instanceof PhotoSessionExpired) toast.error(t('inventoryPage.photoSessionExpired'))
          else if (err instanceof PhotoQuotaExceeded) showAlert(t('inventoryPage.photoQuotaExceeded'), 'error')
          else if (err instanceof PhotoStorageUnavailable) toast.error(t('inventoryPage.photoStorageUnavailable'))
          else if (err instanceof PhotoProviderNotConfigured) toast.error(err.message)
          else toast.error(t('inventoryPage.photoUploadError'))
        })
        .finally(() => {
          bulkInFlightRef.current.delete(promise)
          void queryClient.invalidateQueries({ queryKey: ['photo-usage'] })
          setBulkItems(prev => prev.map(r => (r.id === rowId ? { ...r, pending: r.pending.filter(p => p.id !== id) } : r)))
          URL.revokeObjectURL(localUrl)
        })
    }
  }

  const removeBulkPhoto = (rowId: string, index: number) => {
    const ph = bulkItems.find(r => r.id === rowId)?.photos[index]
    if (ph && bulkUploadsRef.current.delete(ph.url)) void deletePhotosIfUnused([ph]).catch(() => {})
    patchBulkRow(rowId, r => ({ ...r, photos: r.photos.filter((_, i) => i !== index) }))
  }

  const removeBulkRow = (rowId: string) => {
    const row = bulkItems.find(r => r.id === rowId)
    if (!row || bulkItems.length <= 1) return
    const orphans = row.photos.filter(ph => bulkUploadsRef.current.delete(ph.url))
    if (orphans.length) void deletePhotosIfUnused(orphans).catch(() => {})
    setBulkItems(prev => prev.filter(r => r.id !== rowId))
  }

  const removePhoto = (index: number) => {
    const ph = photos[index]
    // Только что загруженное и не сохранённое — удаляем из хранилища сразу.
    // Сохранённое ранее (редактирование) удалит родитель после успешного сохранения.
    if (ph && sessionUploadsRef.current.delete(ph.url)) void deletePhotosIfUnused([ph]).catch(() => {})
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const copyOem = async () => {
    const val = (formData.part_number || '').trim()
    if (!val) return
    try {
      await navigator.clipboard.writeText(val)
      setOemCopied(true)
      toast.success(t('inventoryPage.oemCopied'))
      setTimeout(() => setOemCopied(false), 1500)
    } catch {
      toast.error(t('inventoryPage.copyError'))
    }
  }

  const handleSubmit = (e: React.SyntheticEvent, addAnother = false) => {
    e.preventDefault()
    if (bulkMode) {
      const valid = bulkItems.filter(r => r.name.trim())
      if (!valid.length) {
        toast.error(t('inventoryPage.addAtLeastOne'))
        return
      }
      if (bulkHasPending(bulkItems)) return
      // файлы теперь принадлежат создаваемым позициям — при закрытии их не чистим
      bulkSubmittedRef.current = true
      onSaveBulk?.(buildBulkInputs(bulkItems, bulkShared))
    } else {
      // Валидация: имя без пробелов (HTML required пропускает пробелы).
      if (!formData.name.trim()) {
        toast.error(t('inventoryPage.nameRequired'))
        nameInputRef.current?.focus()
        return
      }
      // Можно сохранять не дожидаясь выгрузки: передаём готовые фото + промисы
      // ещё грузящихся — родитель допишет их в товар в фоне.
      const inFlight = pendingPhotos.map(p => p.promise)
      // Фото этой отправки: реестр чистим только при УСПЕХЕ сохранения (иначе файлы удалятся при уходе).
      const snapshot = [...sessionUploadsRef.current.keys()]
      // пока идёт сохранение — чистку сирот при размонтировании отключаем
      submittedRef.current = true
      const done = (ok: boolean) => {
        if (ok) for (const k of snapshot) sessionUploadsRef.current.delete(k)
        if (!ok && !addAnother) submittedRef.current = false
      }
      onSave(
        {
          ...formData,
          name: formData.name.trim(),
          part_number: formData.part_number?.trim().toUpperCase() || '',
          quantity: formData.quantity || 1,
          photos,
        },
        inFlight,
        addAnother,
        done,
      )
      if (addAnother) {
        // Следующая позиция: новое «поколение» формы (поздние фото-коллбэки прошлой
        // позиции не попадут в новую). Липкие поля (авто/категория/состояние/валюта/
        // место/кол-во) сохраняем — сбрасываем только то, что у каждой позиции своё.
        formGenRef.current += 1
        submittedRef.current = false
        setPhotos([])
        setPendingPhotos([])
        setFormData(prev => ({
          ...prev,
          name: '',
          part_number: '',
          description: '',
          selling_price: undefined,
          purchase_price: undefined,
          status: undefined,
          market_category: null,
          market_category_locked: false,
        }))
        setOemCopied(false)
        oemInputRef.current?.focus()
      }
    }
  }

  // Метки для предпросмотра карточки (правая колонка на десктопе).
  const previewConditionLabel = formData.condition === 'new'
    ? t('inventoryPage.conditionNew')
    : formData.condition === 'damaged'
      ? t('inventoryPage.conditionDamaged')
      : t('inventoryPage.conditionUsed')
  const previewPlaceLabel = formData.storage_location_id
    ? buildLocationOptions(storageLocations).find(o => o.id === formData.storage_location_id)?.label
    : undefined

  return (
    <div className={asPage ? '' : 'modal-overlay'}>
      {!asPage && <div className="absolute inset-0" />}
      <div className={asPage
        ? 'w-full'
        : 'modal-sheet w-full max-w-none sm:max-w-5xl z-10 h-[100dvh] sm:h-[94dvh] rounded-none sm:rounded-2xl flex flex-col overflow-hidden'}>
        {!asPage && <div className="modal-handle sm:hidden" />}
        <form onSubmit={handleSubmit} className={asPage ? 'flex flex-col' : 'flex flex-col flex-1 min-h-0'}>
          <div className={asPage ? 'flex items-center gap-3 mb-4' : 'modal-header flex-shrink-0'}>
            {asPage && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('inventoryPage.cancel')}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            <h3 className="text-base font-bold text-gray-900">
              {item ? t('inventoryPage.editPart') : t('inventoryPage.addPart')}
            </h3>
          </div>
          <div className={asPage ? '' : 'modal-body flex-1 overflow-y-auto min-h-0'}>
            <div className="space-y-4">

              {/* Auto-filled reminder — последнее авто и/или место хранения */}
              {(autoFilledVehicle || autoFilledStorage) && !autoHintDismissed && (() => {
                const v = vehicles.find(x => x.id === (bulkMode ? bulkShared.vehicle_id : formData.vehicle_id))
                const loc = buildLocationOptions(storageLocations).find(o => o.id === (bulkMode ? bulkShared.storage_location_id : formData.storage_location_id))
                if (!v && !loc) return null
                return (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200/60 rounded-xl text-sm text-amber-800">
                    <span>
                      {t('inventoryPage.autoFilledLast')}{' '}
                      {v && <strong>{v.make} {v.model} {v.year}</strong>}
                      {v && loc && <span className="text-amber-400"> · </span>}
                      {loc && <strong>{loc.label}</strong>}
                    </span>
                    <button type="button" onClick={() => setAutoHintDismissed(true)} className="text-amber-600 hover:text-amber-700 text-xs font-semibold shrink-0">
                      {t('inventoryPage.ok')}
                    </button>
                  </div>
                )
              })()}

              {!item && (
                <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                      !bulkMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t('inventoryPage.singlePart')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode(true)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                      bulkMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t('inventoryPage.bulkList')}
                  </button>
                </div>
              )}

              {bulkMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">{t('inventoryPage.sourceVehicle')}</label>
                      <select
                        value={bulkShared.vehicle_id}
                        onChange={(e) => {
                        setBulkShared({ ...bulkShared, vehicle_id: e.target.value, category_id: '' })
                        onVehicleChange?.(e.target.value)
                      }}
                        className="form-select"
                      >
                        <option value="">{t('inventoryPage.notLinked')}</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.make} {vehicle.model} {vehicle.year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">{t('inventoryPage.category')}</label>
                      <select
                        value={bulkShared.category_id}
                        onChange={(e) => setBulkShared({ ...bulkShared, category_id: e.target.value })}
                        className="form-select"
                      >
                        <option value="">{t('inventoryPage.noCategory')}</option>
                        {(bulkShared.vehicle_id
                          ? getCategoriesForVehicle(bulkShared.vehicle_id, vehicles, categories)
                          : categories
                        ).map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">{t('inventoryPage.condition')}</label>
                      <select
                        value={bulkShared.condition}
                        onChange={(e) => setBulkShared({ ...bulkShared, condition: e.target.value })}
                        className="form-select"
                      >
                        <option value="new">{t('inventoryPage.conditionNew')}</option>
                        <option value="used">{t('inventoryPage.conditionUsed')}</option>
                        <option value="damaged">{t('inventoryPage.conditionDamaged')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">{t('inventoryPage.storageLocation')}</label>
                      {storageLocations.length > 0 ? (
                        <StorageLocationCascade
                          locations={storageLocations}
                          value={bulkShared.storage_location_id || undefined}
                          onChange={(id) => {
                            setBulkShared({ ...bulkShared, storage_location_id: id || '' })
                            onStorageChange?.(id || '')
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder={t('inventoryPage.storagePlaceholder')}
                          className="form-input bg-gray-50 cursor-not-allowed"
                          disabled
                        />
                      )}
                    </div>
                  </div>

                  {/* Bulk items table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label">
                        {t('inventoryPage.partsList')}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasteArea(v => !v)
                            setPasteText('')
                          }}
                          className={`cab-btn cab-btn-sm flex items-center gap-1.5 ${
                            showPasteArea
                              ? 'cab-btn-primary'
                              : 'cab-btn-secondary'
                          }`}
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          {t('inventoryPage.pasteList')}
                        </button>
                        <span className="kicker">{t('inventoryPage.currency')}</span>
                        <button
                          type="button"
                          onClick={() => setBulkShared(prev => ({ ...prev, price_currency: prev.price_currency === 'USD' ? 'UAH' : 'USD' }))}
                          className="cab-btn cab-btn-primary cab-btn-sm w-9 text-center px-0"
                          title={t('inventoryPage.changeCurrency')}
                        >
                          {bulkShared.price_currency === 'USD' ? '$' : 'грн'}
                        </button>
                      </div>
                    </div>

                    {/* Paste area */}
                    {showPasteArea && (
                      <div className="mb-3 p-3 bg-slate-100 border border-slate-200 rounded-lg">
                        <p className="text-xs text-slate-700 mb-2">
                          {t('inventoryPage.pasteFormatPrefix')} <span className="font-mono font-semibold">{t('inventoryPage.pasteFormatCols')}</span><br />
                          {t('inventoryPage.pasteFormatHint1')} <span className="font-mono">{t('inventoryPage.pasteFormatStatuses')}</span> {t('inventoryPage.pasteFormatHint2')}
                        </p>
                        <textarea
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          rows={6}
                          placeholder={'Капот\t800\t\t\nКрыло\t650\t1234567-00-A\nПанорама\t750\t\tБронь\nДверь передняя\t\t\tПродано'}
                          className="form-input font-mono resize-none border-slate-300"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-primary">
                            {pasteText.trim() ? t('inventoryPage.linesRecognized', { n: parseBulkText(pasteText).length }) : ''}
                          </span>
                          <button
                            type="button"
                            disabled={!pasteText.trim()}
                            onClick={() => {
                              const parsed = parseBulkText(pasteText)
                              if (parsed.length) {
                                setBulkItems(parsed)
                                setShowPasteArea(false)
                                setPasteText('')
                              }
                            }}
                            className="cab-btn cab-btn-primary cab-btn-sm disabled:opacity-40"
                          >
                            {t('inventoryPage.apply')}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                      <div className="sm:min-w-[480px]">
                      <div className="hidden sm:grid gap-0 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 border-b border-gray-200" style={{ gridTemplateColumns: '1fr 80px 110px 108px 32px' }}>
                        <span>{t('inventoryPage.colNameReq')}</span>
                        <span>{t('inventoryPage.colPrice')}</span>
                        <span>{t('inventoryPage.colOem')}</span>
                        <span>{t('inventoryPage.colStatus')}</span>
                        <span></span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {bulkItems.map((row, idx) => (
                          <div key={row.id}>
                          <div className="grid grid-cols-[1fr_1fr_40px] gap-2 sm:gap-0 sm:grid-cols-[1fr_80px_110px_108px_32px] items-center px-3 py-2 sm:py-1.5">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => {
                                const next = [...bulkItems]
                                next[idx] = { ...next[idx], name: e.target.value }
                                setBulkItems(next)
                              }}
                              placeholder={t('inventoryPage.namePlaceholderShort')}
                              className="w-full col-span-2 col-start-1 row-start-1 sm:col-span-1 sm:col-start-auto sm:row-start-auto min-h-[40px] sm:min-h-0 px-2 sm:px-0 sm:pr-2 py-1.5 text-sm border border-gray-200 rounded-md sm:border-0 sm:rounded-none focus:outline-none focus:ring-0"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.selling_price}
                              onChange={(e) => {
                                const next = [...bulkItems]
                                next[idx] = { ...next[idx], selling_price: e.target.value }
                                setBulkItems(next)
                              }}
                              placeholder="0"
                              className="w-full min-h-[40px] sm:min-h-0 py-1.5 text-sm border border-gray-200 rounded-md sm:rounded-none sm:border-0 sm:border-l px-2 sm:pr-2 focus:outline-none focus:ring-0"
                            />
                            <input
                              type="text"
                              value={row.part_number}
                              autoCapitalize="characters"
                              autoCorrect="off"
                              spellCheck={false}
                              onChange={(e) => {
                                const next = [...bulkItems]
                                next[idx] = { ...next[idx], part_number: e.target.value.toUpperCase() }
                                setBulkItems(next)
                              }}
                              placeholder={t('inventoryPage.oemPlaceholder')}
                              className="w-full col-span-2 min-h-[40px] sm:min-h-0 sm:col-span-1 py-1.5 text-sm border border-gray-200 rounded-md sm:rounded-none sm:border-0 sm:border-l px-2 sm:pr-2 focus:outline-none focus:ring-0 font-mono uppercase"
                            />
                            <select
                              value={row.status}
                              onChange={(e) => {
                                const next = [...bulkItems]
                                next[idx] = { ...next[idx], status: e.target.value as PartsInventoryStatus }
                                setBulkItems(next)
                              }}
                              className={`w-full col-span-3 sm:col-span-1 min-h-[40px] sm:min-h-0 py-1.5 text-xs border border-gray-200 rounded-md sm:rounded-none sm:border-0 sm:border-l pl-2 pr-1 focus:outline-none focus:ring-0 font-medium ${
                                row.status === 'available' ? 'text-green-700 bg-green-50' :
                                row.status === 'reserved' ? 'text-yellow-700 bg-yellow-50' :
                                row.status === 'sold'     ? 'text-gray-500 bg-gray-50' :
                                                            'text-red-700 bg-red-50'
                              }`}
                            >
                              <option value="available">{t('inventoryPage.status_available')}</option>
                              <option value="reserved">{t('inventoryPage.statusReservedShort')}</option>
                              <option value="sold">{t('inventoryPage.status_sold')}</option>
                              <option value="damaged">{t('inventoryPage.status_damaged')}</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                removeBulkRow(row.id)
                              }}
                              className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto min-h-[40px] sm:min-h-0 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                              aria-label={t('inventoryPage.removeRow')}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
                            <label
                              className={`inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-2.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium cursor-pointer ${row.photos.length + row.pending.length >= MAX_PHOTOS ? 'opacity-40 pointer-events-none' : ''}`}
                              title={t('inventoryPage.addPhotoShort')}
                            >
                              <Camera className="w-4 h-4" />
                              <span>{row.photos.length + row.pending.length}/{MAX_PHOTOS}</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="sr-only"
                                aria-label={t('inventoryPage.addPhotoShort')}
                                onChange={(e) => handleBulkPhotoSelect(row.id, e)}
                              />
                            </label>
                            {row.photos.map((ph, pi) => (
                              <div key={ph.url} className="relative w-10 h-10 shrink-0">
                                <img src={ph.thumb_url || ph.url} alt="" className="w-10 h-10 rounded-md object-cover border border-gray-200" />
                                <button
                                  type="button"
                                  onClick={() => removeBulkPhoto(row.id, pi)}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-red-500 flex items-center justify-center"
                                  aria-label={t('inventoryPage.removePhoto')}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {row.pending.map(p => (
                              <div key={p.id} className="relative w-10 h-10 shrink-0">
                                <img src={p.localUrl} alt="" className="w-10 h-10 rounded-md object-cover border border-gray-200 opacity-50" />
                                <span className="absolute inset-0 flex items-center justify-center"><Spinner /></span>
                              </div>
                            ))}
                          </div>
                          </div>
                        ))}
                      </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkItems(prev => [...prev, newBulkRow()])}
                      className="mt-2 cab-btn cab-btn-ghost cab-btn-sm flex items-center gap-1.5 text-primary"
                    >
                      <Plus className="w-4 h-4" />
                      {t('inventoryPage.addRow')}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
                {/* ЛЕВАЯ колонка (десктоп): поля. contents+order — чтобы мобильный порядок
                    сохранился точь-в-точь, а на lg колонки стали независимыми (без наложений). */}
                <div className="contents lg:block lg:space-y-4">
                {/* Оригинальный номер — на всю строку */}
                <div className="order-1">
                  <label className="form-label">
                    {t('inventoryPage.oemLabel')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={oemInputRef}
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      value={formData.part_number}
                      onChange={(e) => setFormData({ ...formData, part_number: e.target.value.toUpperCase() })}
                      placeholder={t('inventoryPage.oemExample')}
                      className="form-input flex-1 min-w-0 font-mono uppercase tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={copyOem}
                      disabled={!formData.part_number?.trim()}
                      className="cab-btn cab-btn-secondary flex-shrink-0 w-11 px-0 flex items-center justify-center disabled:opacity-40"
                      title={t('inventoryPage.copyOemTitle')}
                      aria-label={t('inventoryPage.copyOemTitle')}
                    >
                      {oemCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Название — на всю строку */}
                <div className="order-2">
                  <label className="form-label">
                    {t('inventoryPage.nameReq')}
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                  />
                </div>

                {/* Состояние (слева) + Цена продажи и валюта (справа) — одна строка */}
                <div className="grid grid-cols-2 gap-3 order-3">
                  <div>
                    <label className="form-label">
                      {t('inventoryPage.conditionReq')}
                    </label>
                    <select
                      required
                      value={formData.condition}
                      onChange={(e) => {
                        setFormData({ ...formData, condition: e.target.value })
                        sessionStorage.setItem('parts_last_condition', e.target.value)
                      }}
                      className="form-select"
                    >
                      <option value="new">{t('inventoryPage.conditionNew')}</option>
                      <option value="used">{t('inventoryPage.conditionUsed')}</option>
                      <option value="damaged">{t('inventoryPage.conditionDamaged')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{t('inventoryPage.sellPrice')}</label>
                    {/* Валюта цветом: $ → мягкий зелёный (чтобы не перепутать с грн) */}
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={formData.selling_price ?? ''}
                        onChange={(e) => setFormData({ ...formData, selling_price: e.target.value ? Number(e.target.value) : undefined })}
                        className={`form-input flex-1 min-w-0 tabular ${
                          formData.price_currency === 'USD'
                            ? 'border-emerald-300 bg-emerald-50/50 text-emerald-700 font-semibold focus:border-emerald-400 focus:ring-emerald-200'
                            : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = formData.price_currency === 'USD' ? 'UAH' : 'USD'
                          setFormData({ ...formData, price_currency: next })
                          sessionStorage.setItem('parts_last_currency', next)
                        }}
                        className={`cab-btn flex-shrink-0 w-12 text-center px-0 font-bold ${
                          formData.price_currency === 'USD'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                            : 'cab-btn-primary'
                        }`}
                        title={t('inventoryPage.changeCurrency')}
                      >
                        {formData.price_currency === 'USD' ? '$' : 'грн'}
                      </button>
                    </div>
                  </div>
                </div>
                </div>

                {/* ПРАВАЯ колонка (десктоп): фото → место → предпросмотр. На lg — flex,
                    чтобы order задавал порядок; на мобиле contents держат общий порядок. */}
                <div className="contents lg:flex lg:flex-col lg:gap-4">
                {/* Место хранения */}
                <div className="order-4 lg:order-2">
                  <label className="form-label">{t('inventoryPage.storageLocation')}</label>
                  {storageLocations.length > 0 ? (
                    <StorageLocationCascade
                      locations={storageLocations}
                      value={formData.storage_location_id}
                      onChange={(id) => {
                        setFormData({ ...formData, storage_location_id: id })
                        onStorageChange?.(id || '')
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder={t('inventoryPage.storagePlaceholder')}
                      className="form-input"
                    />
                  )}
                </div>

                <div className="order-5 lg:order-1">
                  <label className="form-label">{t('inventoryPage.photos')} <span className="text-gray-400 font-normal">({photos.length + pendingPhotos.length}/{MAX_PHOTOS})</span></label>
                  {(photos.length + pendingPhotos.length) >= MAX_PHOTOS ? (
                    <div className="flex items-center justify-center gap-2 w-full h-24 sm:h-28 border-2 border-dashed border-gray-200 bg-gray-50 rounded-xl text-sm font-medium text-gray-400">
                      {t('inventoryPage.photoLimitReached', { max: MAX_PHOTOS })}
                    </div>
                  ) : (
                  <div className="space-y-2">
                    {/* Десктоп — крупная зона drag&drop / выбора файлов */}
                    <label className="hidden sm:flex flex-col items-center justify-center gap-1.5 w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer transition-colors hover:border-blue-400 hover:bg-gray-50">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoSelect}
                        className="sr-only"
                      />
                      <Upload className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
                      <span className="text-sm font-medium text-gray-600">
                        {t('inventoryPage.addPhoto', { remaining: MAX_PHOTOS - photos.length - pendingPhotos.length })}
                      </span>
                    </label>
                    {/* Мобилка — одна кнопка «Добавить фото» открывает лист выбора способа */}
                    <button
                      type="button"
                      onClick={() => setPhotoSheetOpen(true)}
                      className="sm:hidden flex items-center justify-center gap-2 w-full h-11 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Camera className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                      {t('inventoryPage.addPhotoBtn', { defaultValue: 'Добавить фото' })}
                    </button>
                  </div>
                  )}
                  {(photos.length > 0 || pendingPhotos.length > 0) && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {photos.map((photo, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={photo.thumb_url || photo.url}
                            alt={t('inventoryPage.photoAlt', { n: i + 1 })}
                            className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label={t('inventoryPage.removePhoto')}
                            className="absolute -top-3 -right-3 w-11 h-11 sm:-top-2 sm:-right-2 sm:w-7 sm:h-7 flex items-center justify-center [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          >
                            <span className="w-5 h-5 bg-red-500 text-white rounded-md flex items-center justify-center">
                              <X className="w-3 h-3" />
                            </span>
                          </button>
                        </div>
                      ))}
                      {/* Превью фото, которые ещё грузятся в фоне */}
                      {pendingPhotos.map((p) => (
                        <div key={p.id} className="relative">
                          <img
                            src={p.localUrl}
                            alt={t('inventoryPage.uploadingAlt')}
                            className="w-16 h-16 object-cover rounded-xl border border-gray-200 opacity-50"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner size="sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploading && (
                    <p className="mt-1.5 text-xs text-gray-400">{t('inventoryPage.photosUploadingHint')}</p>
                  )}
                </div>

                {/* Предпросмотр карточки — под местом хранения (десктоп) */}
                <div className="hidden lg:block order-8 lg:order-3 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-3 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {t('inventoryPage.previewLabel', { defaultValue: 'Предпросмотр' })}
                  </div>
                  <div className="p-3">
                    <div className="aspect-[4/3] rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center mb-3">
                      {photos[0] ? (
                        <img src={photos[0].thumb_url || photos[0].url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {formData.name || t('inventoryPage.previewNamePlaceholder', { defaultValue: 'Название запчасти' })}
                    </p>
                    {formData.part_number && (
                      <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{formData.part_number}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {formData.selling_price != null && (
                        <span className="text-base font-bold text-emerald-600">
                          {formData.selling_price.toLocaleString(intlLocale())} {formData.price_currency === 'USD' ? '$' : '₴'}
                        </span>
                      )}
                      <span className="badge badge-gray">{previewConditionLabel}</span>
                      {previewPlaceLabel && <span className="badge badge-blue">{previewPlaceLabel}</span>}
                    </div>
                  </div>
                </div>
                </div>

                {/* Источник (авто) — на всю ширину под колонками */}
                <div className="order-6 lg:col-span-2">
                  <label className="form-label">{t('inventoryPage.sourceVehicle')}</label>
                  <select
                    value={formData.vehicle_id || ''}
                    onChange={(e) => {
                      const newVehicleId = e.target.value || undefined
                      // Разборочная запчасть с авто — закупочной цены нет (себестоимость от авто),
                      // поэтому очищаем purchase_price при привязке к авто. Для магазина не трогаем.
                      setFormData({
                        ...formData,
                        vehicle_id: newVehicleId,
                        category_id: '',
                        ...(newVehicleId && !isShop ? { purchase_price: undefined } : {}),
                      })
                      if (newVehicleId) onVehicleChange?.(newVehicleId)
                      else onVehicleChange?.('')
                    }}
                    className="form-select"
                  >
                    <option value="">{t('inventoryPage.notLinkedToVehicle')}</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} {vehicle.year}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('inventoryPage.sourceVehicleHint')}
                  </p>
                </div>

                {/* Дополнительно — редкие поля свёрнуты (Вариант A), на всю ширину */}
                <div className="order-7 lg:col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <span>{t('inventoryPage.moreFields', { defaultValue: 'Дополнительно' })}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showMore ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>
                  {showMore && (
                    <div className="space-y-4 mt-4">
                      {/* Раздел на маркете: авто по названию либо ручной выбор */}
                      <div>
                        <label className="form-label" htmlFor="inv-market-section">
                          {t('inventoryPage.marketSection')}
                        </label>
                        <select
                          id="inv-market-section"
                          value={sectionMode}
                          onChange={(e) => handleSectionChange(e.target.value)}
                          className="form-select"
                          aria-describedby="inv-market-section-hint"
                        >
                          <option value="auto">
                            {autoSection
                              ? t('inventoryPage.marketSectionAutoNamed', { name: marketSectionName(autoSection, i18n.language) })
                              : t('inventoryPage.marketSectionAuto')}
                          </option>
                          {sections.map((s) => (
                            <option key={s.slug} value={s.slug}>{marketSectionName(s, i18n.language)}</option>
                          ))}
                          <option value="none">{t('inventoryPage.marketSectionNone')}</option>
                        </select>
                        <p id="inv-market-section-hint" className="mt-1 text-xs text-gray-500">
                          {t('inventoryPage.marketSectionHint')}
                        </p>
                      </div>

                      {/* Внутренняя категория */}
                      <div>
                        <label className="form-label" htmlFor="inv-internal-category">
                          {t('inventoryPage.internalCategory')}
                        </label>
                        <select
                          id="inv-internal-category"
                          value={formData.category_id}
                          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="form-select"
                        >
                          <option value="">{t('inventoryPage.noCategory')}</option>
                          {(formData.vehicle_id
                            ? getCategoriesForVehicle(formData.vehicle_id, vehicles, categories)
                            : categories
                          ).map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Кол-во — только для магазинных (для запчасти с авто кол-во = 1). */}
                      {!formData.vehicle_id && (
                        <div>
                          <label className="form-label">{t('inventoryPage.quantity')}</label>
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={formData.quantity ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              // Пустое поле держим как undefined (плейсхолдер), в БД уходит quantity||1.
                              setFormData({ ...formData, quantity: (v === '' ? undefined : Number(v)) as unknown as number })
                            }}
                            className="form-input tabular"
                          />
                        </div>
                      )}

                      {/* Закупочная цена — только для магазина (у разборки себестоимость от авто). */}
                      {isShop && (
                        <div>
                          <label className="form-label">
                            {t('inventoryPage.purchasePrice')} <span className="text-gray-400 font-normal">{t('inventoryPage.purchasePriceHint')}</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={formData.purchase_price ?? ''}
                            onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value ? Number(e.target.value) : undefined })}
                            placeholder={t('inventoryPage.optionalPlaceholder')}
                            className="form-input tabular"
                          />
                          {formData.purchase_price != null && formData.selling_price != null && formData.selling_price < formData.purchase_price && (
                            <p className="mt-1 text-xs text-amber-600">{t('inventoryPage.marginNegative')}</p>
                          )}
                        </div>
                      )}

                      {/* Описание */}
                      <div>
                        <label className="form-label">
                          {t('inventoryPage.description')}
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={2}
                          className="form-input resize-none"
                        />
                      </div>

                      {/* Заметки */}
                      <div>
                        <label className="form-label">{t('inventoryPage.notes')}</label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={2}
                          className="form-input resize-none"
                        />
                      </div>

                      {/* Отметить проданной — только при создании */}
                      {!item && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, status: formData.status === 'sold' ? 'available' : 'sold' })}
                          className={`w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                            formData.status === 'sold'
                              ? 'bg-gray-800 border-gray-800 text-white'
                              : 'cab-btn cab-btn-secondary border-2 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                          }`}
                        >
                          {formData.status === 'sold' ? t('inventoryPage.soldCheck') : t('inventoryPage.markAsSold')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>

            </div>
          <div className={asPage ? 'flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100' : 'modal-footer flex-shrink-0'}>
            <button
              type="button"
              onClick={onClose}
              className={asPage ? 'cab-btn cab-btn-secondary' : 'modal-btn-cancel'}
            >
              {t('inventoryPage.cancel')}
            </button>
            {/* «Сохранить и добавить ещё» — только при создании одиночной позиции:
                не закрывает модалку, очищает форму, липкие поля сохраняет. */}
            {!item && !bulkMode && (
              <button
                type="button"
                disabled={isSaving}
                onClick={(e) => handleSubmit(e, true)}
                className="cab-btn cab-btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t('inventoryPage.saveAndAddAnother')}
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || (bulkMode && bulkHasPending(bulkItems))}
              className="cab-btn cab-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving
                ? t('inventoryPage.saving')
                : bulkMode && bulkHasPending(bulkItems)
                  ? t('inventoryPage.photosUploadingWait')
                  : bulkMode
                  ? t('inventoryPage.addNParts', { n: bulkItems.filter(r => r.name.trim()).length || '' })
                  : item ? t('inventoryPage.save') : t('inventoryPage.add')}
            </button>
          </div>
        </form>

        {/* Лист выбора способа добавления фото (мобилка) */}
        {photoSheetOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] flex items-start sm:items-center justify-center px-3 py-3"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top,0px))' }}
            onClick={() => setPhotoSheetOpen(false)}
          >
            <div
              className="w-full sm:max-w-xs bg-white rounded-2xl p-4 animate-slide-down sm:animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-sm font-bold text-gray-900 mb-3">
                {t('inventoryPage.addPhotoBtn', { defaultValue: 'Добавить фото' })}
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3 w-full h-12 px-3 border border-gray-200 rounded-xl cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => { handlePhotoSelect(e); setPhotoSheetOpen(false) }}
                    className="sr-only"
                  />
                  <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                  </span>
                  {t('inventoryPage.uploadPhotoOption', { defaultValue: 'Загрузить фото' })}
                </label>
                {/* capture открывает камеру напрямую */}
                <label className="flex items-center gap-3 w-full h-12 px-3 border border-gray-200 rounded-xl cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => { handlePhotoSelect(e); setPhotoSheetOpen(false) }}
                    className="sr-only"
                  />
                  <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Camera className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                  </span>
                  {t('inventoryPage.takePhotoOption', { defaultValue: 'Сделать фото' })}
                </label>
              </div>
              <button
                type="button"
                onClick={() => setPhotoSheetOpen(false)}
                className="mt-3 w-full h-10 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {t('inventoryPage.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
