import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { QueryState } from '@/components/ui/QueryState'
import { SlidersHorizontal, Plus, Layers, Search, Package, Grid, List, AlertTriangle, Tag, Trash2, DollarSign, ChevronDown, ChevronRight, MapPin, FolderOpen, ArrowUp, ArrowDown } from 'lucide-react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import LimitReachedBanner from '@/components/subscription/LimitReachedBanner'
import PhotoLimitNotice from '@/components/subscription/PhotoLimitNotice'
import { InventoryCard } from '@/components/parts/InventoryCard'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import { getPartsInventoryPaged, getPartsInventorySummary, updatePartsInventoryItem, deletePartsInventoryItem, getStorageLocations, bulkUpdateInventory, bulkDeleteInventory, getMarketSections, marketSectionName } from '@/services/partsService'
import type { InventoryQuickFilter } from '@/services/partsService'
import type { PartsInventoryItem, PartsInventoryStatus, StorageLocation, PartsVehicle } from '@/types/parts'
import type { ImgbbPhoto } from '@/services/imgbbService'
import { deletePhotosIfUnused } from '@/services/photoStorage'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/utils/currency'
import { SaleSheet } from '@/components/parts/sale/SaleSheet'
import { lineFromInventory, type SaleLine, type SaleSource } from '@/components/parts/sale/saleLogic'
import { intlLocale } from '@/i18n'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { moveToTrash } from '@/services/trashService'
import { buildLocationOptions, type VehicleDropdownRow, type CategoryDropdownRow } from './partsInventoryShared'

type ViewMode = 'grid' | 'list'

const statusLabel = (s: PartsInventoryStatus): string => i18n.t(`inventoryPage.status_${s}`, { ns: 'cabinet' })

const statusColors: Record<PartsInventoryStatus, string> = {
  available: 'badge badge-green',
  reserved: 'badge badge-yellow',
  sold: 'badge badge-gray',
  damaged: 'badge badge-red'
}

export default function PartsInventory() {
  const { t, i18n } = useTranslation('cabinet')
  const navigate = useNavigate()
  const location = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollEl = () => rootRef.current?.closest('.overflow-auto') as HTMLElement | null
  const goToItem = (id: string) => {
    const el = scrollEl()
    sessionStorage.setItem('parts-inv-scroll', String(el ? el.scrollTop : 0))
    navigate(`/parts/inventory/${id}`)
  }
  const [searchParams, setSearchParams] = useSearchParams()
  // Источник: все / с авто (разборка) / магазин. Без ?source — «Все». Старые ссылки ?source=vehicles|shop работают.
  const sourceParam = searchParams.get('source')
  const sourceFilter: 'all' | 'vehicles' | 'shop' = sourceParam === 'shop' || sourceParam === 'vehicles' ? sourceParam : 'all'
  // Быстрый фильтр (?filter=noPrice|noPhoto|noLocation|stale) — серверный
  const filterParam = searchParams.get('filter')
  const quickFilter: InventoryQuickFilter | undefined =
    filterParam === 'noPrice' || filterParam === 'noPhoto' || filterParam === 'noLocation' || filterParam === 'stale' ? filterParam : undefined
  const setUrlParam = (key: string, value: string | null) =>
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value); else next.delete(key)
      return next
    }, { replace: true })
  // Куда вести «+ Запчасть»: магазин только на вкладке «Магазин», иначе разборка
  const addSource = sourceFilter === 'shop' ? 'shop' : 'vehicles'
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // С быстрым фильтром показываем все непроданные — как считают счётчики на чипах и Пульте
  const [statusFilter, setStatusFilter] = useState<string>(quickFilter ? 'all' : 'available')
  const [vehicleFilter, setVehicleFilter] = useState<string>('all') // vehicle_id or 'all'
  // Фильтр по ячейке склада читается из URL (?location=<id>) — из PartsWarehouse
  const locationParam = searchParams.get('location') ?? 'all'
  const [locationFilter, setLocationFilter] = useState<string>(locationParam)
  useEffect(() => { setLocationFilter(locationParam) }, [locationParam])
  // По умолчанию — компактный список; выбор (список/плитка) запоминается.
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => ((typeof localStorage !== 'undefined' && localStorage.getItem('parts_inventory_view')) as ViewMode) || 'list'
  )
  useEffect(() => { try { localStorage.setItem('parts_inventory_view', viewMode) } catch { /* ignore */ } }, [viewMode])
  const [saleSheet, setSaleSheet] = useState<{ source: SaleSource; items: SaleLine[] } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusPickerItem, setStatusPickerItem] = useState<PartsInventoryItem | null>(null)
  const [pendingStatus, setPendingStatus] = useState<PartsInventoryStatus | null>(null)
  // По умолчанию — по дате добавления, новые сверху (удобно отслеживать последнее добавленное)
  const [filtersOpen, setFiltersOpen] = useState(false) // раскрытие фильтров на телефоне (< md)
  const [sortField, setSortField] = useState<'date' | 'name' | 'status' | 'price'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [isBulkLocationOpen, setIsBulkLocationOpen] = useState(false)
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false)
  const [bulkLocationId, setBulkLocationId] = useState<string>('')
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  // Раздел на маркете: серверный фильтр списка ('all' | slug | 'none') и массовая смена
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [isBulkSectionOpen, setIsBulkSectionOpen] = useState(false)
  const [bulkSection, setBulkSection] = useState<string>('auto') // 'auto' | 'none' | slug

  const { data: profile } = useUserProfile()
  const { rate: usdRate } = usePartsExchangeRate()
  const queryClient = useQueryClient()
  const partsCompanyId = profile?.parts_company_id
  const { canCreate, usage, limits } = useSubscriptionLimits()

  // Debounce поиска ~300мс
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const PAGE_SIZE = 50

  // Места хранения: для фильтра по ячейке и bulk-перемещения
  const { data: storageLocations = [], isSuccess: locationsLoaded } = useQuery({
    queryKey: ['parts-storage-locations', partsCompanyId],
    queryFn: () => getStorageLocations(partsCompanyId!),
    enabled: !!partsCompanyId,
  })
  // Выбранная ячейка + все вложенные
  const locationFilterIds: string[] = (() => {
    if (locationFilter === 'all') return []
    const ids = new Set<string>([locationFilter])
    let grew = true
    while (grew) {
      grew = false
      for (const l of storageLocations as StorageLocation[]) {
        if (l.parent_id && ids.has(l.parent_id) && !ids.has(l.id)) { ids.add(l.id); grew = true }
      }
    }
    return [...ids]
  })()
  const locationLabelById = new Map(buildLocationOptions(storageLocations as StorageLocation[]).map(o => [o.id, o.label]))

  const {
    data: pagedData,
    isLoading,
    isError,
    refetch,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['parts-inventory', 'paged', partsCompanyId, debouncedSearch, statusFilter, vehicleFilter, sourceFilter, locationFilter, locationFilterIds.join(','), sectionFilter, quickFilter ?? ''],
    queryFn: ({ pageParam = 1 }) =>
      getPartsInventoryPaged(partsCompanyId!, {
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        vehicleId: vehicleFilter !== 'all' ? vehicleFilter : undefined,
        source: sourceFilter,
        search: debouncedSearch || undefined,
        storageLocationIds: locationFilterIds.length ? locationFilterIds : undefined,
        marketCategory: sectionFilter !== 'all' ? sectionFilter : undefined,
        quick: quickFilter,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((s, p) => s + p.items.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
    // При выбранной ячейке ждём загрузки списка ячеек, чтобы сразу учесть вложенные
    enabled: !!partsCompanyId && (locationFilter === 'all' || locationsLoaded),
  })

  // Суммарный массив загруженных элементов
  const inventory: PartsInventoryItem[] = pagedData?.pages.flatMap(p => p.items) ?? []
  const totalCount = pagedData?.pages[0]?.total ?? 0

  // Стоимость склада/продаж — серверный агрегат по ВСЕЙ выборке (а не по подгруженным страницам)
  const { data: summary } = useQuery({
    // ключ вложен в ['parts-inventory', …] — те же инвалидации, что и список, обновляют агрегат
    queryKey: ['parts-inventory', 'summary', partsCompanyId, usdRate, sourceFilter],
    queryFn: () => getPartsInventorySummary(partsCompanyId!, usdRate!, sourceFilter === 'shop' ? true : sourceFilter === 'all' ? undefined : false),
    enabled: !!partsCompanyId && usdRate != null,
    staleTime: 60_000,
  })
  const stockUSD = summary?.stockUSD ?? 0
  const soldUSD = summary?.soldUSD ?? 0

  // Восстановление позиции прокрутки при возврате со страницы запчасти
  useEffect(() => {
    if (isLoading) return
    const saved = sessionStorage.getItem('parts-inv-scroll')
    if (saved == null) return
    sessionStorage.removeItem('parts-inv-scroll')
    requestAnimationFrame(() => {
      const el = scrollEl()
      if (el) el.scrollTop = Number(saved)
    })
  }, [isLoading])  

  // Навигация с editItemId в state (напр. из «Без цены или номера») → открываем
  // страницу редактирования. Свежий товар по id грузит уже сама PartsInventoryEdit.
  useEffect(() => {
    const editItemId = location.state?.editItemId
    if (!editItemId) return
    navigate(`/parts/inventory/${editItemId}/edit?source=${addSource}`, { replace: true })
  }, [location.state?.editItemId])

  // Auto-open sell modal when navigated with sellItemId in state (from item page)
  useEffect(() => {
    const sellItemId = location.state?.sellItemId
    if (!sellItemId || inventory.length === 0) return
    const found = inventory.find((i: PartsInventoryItem) => i.id === sellItemId)
    if (found && found.status !== 'sold') {
      setSaleSheet({ source: 'stock', items: [lineFromInventory(found)] })
    }
    navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location.state?.sellItemId, inventory.length])  

  // Смена источника не сбрасывает поиск/статус/раздел/ячейку; сбрасываем только выбор и фильтр по авто
  useEffect(() => {
    setVehicleFilter('all')
    setSelectedIds(new Set())
  }, [sourceFilter])

  // Clear selection when changing status / section / location filter
  useEffect(() => {
    setSelectedIds(new Set())
  }, [statusFilter, sectionFilter, locationFilter, quickFilter])

  // Разделы маркета (справочник, общий для всех разборок)
  const { data: sections = [] } = useQuery({ queryKey: ['market', 'sections'], queryFn: getMarketSections, staleTime: 30 * 60_000 })
  const sectionByslug = useMemo(() => new Map(sections.map(s => [s.slug, s])), [sections])

  // Get categories for dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['parts-categories', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_categories')
        .select('id, name, brand, model')
        .eq('parts_company_id', partsCompanyId)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId
  })

  const deleteMutation = useMutation({
    mutationFn: async (item: PartsInventoryItem) => {
      // Фото НЕ удаляем: товар в корзине можно восстановить. Файлы чистит permanentlyDelete.
      await moveToTrash({
        entityType: 'parts_inventory',
        entityId: item.id,
        entityLabel: t('inventoryPage.trashLabel', { name: item.name }),
        entityData: item,
        partsCompanyId: partsCompanyId,
      })
      await deletePartsInventoryItem(item.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success(t('inventoryPage.toastMovedToTrash'))
    },
    onError: (error: unknown) => {
      const err = error as { status?: number; code?: string } | null
      if (err?.status === 409 || err?.code === '23503') {
        toast.error(t('inventoryPage.toastDeleteInOrder'))
      } else {
        toast.error(t('inventoryPage.toastDeleteError'))
      }
    }
  })

  // Unique vehicles from loaded items for vehicle filter buttons (только в режиме Разборки)
  const uniqueVehicles: VehicleDropdownRow[] = sourceFilter !== 'shop'
    ? Array.from(
        new Map(
          inventory
            .filter((i: PartsInventoryItem) => i.vehicle_id && i.vehicle)
            .map((i: PartsInventoryItem) => [i.vehicle_id as string, i.vehicle as PartsVehicle] as const)
        ).entries()
      ).map(([id, v]) => ({ id, make: v.make, model: v.model, year: v.year }))
    : []

  // If only one vehicle exists — apply it automatically, hide buttons
  const singleVehicle = uniqueVehicles.length === 1 ? uniqueVehicles[0] : null
  const effectiveVehicleFilter = singleVehicle ? singleVehicle.id : vehicleFilter
  const showVehicleButtons = uniqueVehicles.length > 1

  // Фильтрация по авто на клиенте (только если vehicleFilter выбран и мы не передали его на сервер через singleVehicle)
  const filteredInventory = singleVehicle
    ? inventory.filter((i: PartsInventoryItem) => i.vehicle_id === singleVehicle.id)
    : inventory

  // Сортировка загруженных элементов на клиенте
  const statusOrder: Record<PartsInventoryStatus, number> = { available: 0, reserved: 1, damaged: 2, sold: 3 }
  const activeFiltersCount =
    (sectionFilter !== 'all' ? 1 : 0) +
    (locationFilter !== 'all' ? 1 : 0) +
    (vehicleFilter !== 'all' ? 1 : 0) +
    (sortField !== 'date' || sortDir !== 'desc' ? 1 : 0)

  const filteredAndSorted = [...filteredInventory].sort((a: PartsInventoryItem, b: PartsInventoryItem) => {
    // Фильтр «Продано» — по давности продажи: свежие продажи сверху
    if (statusFilter === 'sold') {
      const ta = new Date(a.updated_at || a.created_at).getTime()
      const tb = new Date(b.updated_at || b.created_at).getTime()
      return tb - ta
    }
    let cmp = 0
    if (sortField === 'date') {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      cmp = ta - tb // asc = старые сверху; sortDir='desc' (по умолчанию) → новые сверху
    } else if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name, 'ru')
    } else if (sortField === 'status') {
      cmp = statusOrder[a.status] - statusOrder[b.status]
    } else if (sortField === 'price') {
      // Сравниваем в общей валюте (USD): грн → делим на курс, иначе как есть —
      // иначе $100 «дешевле» 1000 грн при прямом сравнении чисел.
      const toUSD = (it: PartsInventoryItem) => {
        const p = it.selling_price || 0
        // Курс ещё не загружен — не нормализуем грн (сравниваем как есть, без NaN)
        if (it.price_currency === 'UAH') return usdRate != null ? p / usdRate : p
        return p
      }
      cmp = toUSD(a) - toUSD(b)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Статистика — по загруженным элементам текущего среза
  const stats = {
    total: totalCount,
    totalQuantity: inventory.reduce((sum: number, item: PartsInventoryItem) => sum + item.quantity, 0),
    available: inventory.filter((i: PartsInventoryItem) => i.status === 'available').length,
    reserved: inventory.filter((i: PartsInventoryItem) => i.status === 'reserved').length,
    sold: inventory.filter((i: PartsInventoryItem) => i.status === 'sold').length,
    lowStock: inventory.filter((i: PartsInventoryItem) => !i.vehicle_id && i.quantity <= 2 && i.status === 'available').length,
    totalUAH: inventory.reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.status === 'sold' ? (item.sold_price ?? item.selling_price ?? 0) : (item.selling_price || 0)
      return item.price_currency === 'UAH' ? sum + price * item.quantity : sum
    }, 0),
    totalUSD: inventory.reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.status === 'sold' ? (item.sold_price ?? item.selling_price ?? 0) : (item.selling_price || 0)
      return (item.price_currency === 'USD' || !item.price_currency) ? sum + price * item.quantity : sum
    }, 0),
    availableUSD: inventory.filter((i: PartsInventoryItem) => i.status === 'available').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.selling_price || 0
      if (item.price_currency === 'USD' || !item.price_currency) return sum + price * item.quantity
      // Грн → USD: курс ещё не загружен — пропускаем конвертацию (без NaN)
      return usdRate != null ? sum + price * item.quantity / usdRate : sum
    }, 0),
    reservedUSD: inventory.filter((i: PartsInventoryItem) => i.status === 'reserved').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.selling_price || 0
      if (item.price_currency === 'USD' || !item.price_currency) return sum + price * item.quantity
      return usdRate != null ? sum + price * item.quantity / usdRate : sum
    }, 0),
    stockUSD: inventory.filter((i: PartsInventoryItem) => i.status === 'available' || i.status === 'reserved').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.selling_price || 0
      if (item.price_currency === 'USD' || !item.price_currency) return sum + price * item.quantity
      return usdRate != null ? sum + price * item.quantity / usdRate : sum
    }, 0),
    soldUSD: inventory.filter((i: PartsInventoryItem) => i.status === 'sold').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.sold_price ?? item.selling_price ?? 0
      if (item.price_currency === 'USD' || !item.price_currency) return sum + price * item.quantity
      return usdRate != null ? sum + price * item.quantity / usdRate : sum
    }, 0),
  }

  const toggleSelect = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openBulkSell = useCallback(() => {
    const items = inventory.filter((i: PartsInventoryItem) => selectedIds.has(i.id))
    setSaleSheet({ source: 'stock-bulk', items: items.map(lineFromInventory) })
  }, [inventory, selectedIds])

  const handleEdit = (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/parts/inventory/${item.id}/edit?source=${addSource}`)
  }

  const handleSell = (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setSaleSheet({ source: 'stock', items: [lineFromInventory(item)] })
  }

  const statusChangeMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PartsInventoryStatus }) =>
      updatePartsInventoryItem(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('inventoryPage.toastStatusUpdated'))
    },
    onError: () => toast.error(t('inventoryPage.toastStatusError')),
  })

  const handleStatusClick = (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setStatusPickerItem(item)
  }

  const bulkLocationMutation = useMutation({
    mutationFn: ({ ids, locationId }: { ids: string[]; locationId: string | null }) =>
      bulkUpdateInventory(ids, { storage_location_id: locationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('inventoryPage.toastBulkLocation', { n: selectedIds.size }))
      setSelectedIds(new Set())
      setIsBulkLocationOpen(false)
      setBulkLocationId('')
    },
    onError: () => toast.error(t('inventoryPage.toastBulkLocationError')),
  })

  const bulkSectionMutation = useMutation({
    mutationFn: ({ ids, section }: { ids: string[]; section: string }) =>
      bulkUpdateInventory(
        ids,
        section === 'auto'
          ? { market_category_locked: false }
          : { market_category: section === 'none' ? null : section, market_category_locked: true },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('inventoryPage.toastBulkSection', { n: selectedIds.size }))
      setSelectedIds(new Set())
      setIsBulkSectionOpen(false)
      setBulkSection('auto')
    },
    onError: () => toast.error(t('inventoryPage.toastBulkSectionError')),
  })

  const bulkCategoryMutation = useMutation({
    mutationFn: ({ ids, categoryId }: { ids: string[]; categoryId: string | null }) =>
      bulkUpdateInventory(ids, { category_id: categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('inventoryPage.toastBulkCategory', { n: selectedIds.size }))
      setSelectedIds(new Set())
      setIsBulkCategoryOpen(false)
      setBulkCategoryId('')
    },
    onError: () => toast.error(t('inventoryPage.toastBulkCategoryError')),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Позиции удаляются без корзины: файлы фото чистим только после успешного удаления из БД
      const idSet = new Set(ids)
      const photos = inventory
        .filter((i: PartsInventoryItem) => idSet.has(i.id))
        .flatMap((i: PartsInventoryItem) => ((i.photos as ImgbbPhoto[] | undefined) ?? []))
      await bulkDeleteInventory(ids)
      if (photos.length) await deletePhotosIfUnused(photos).catch((e) => console.error('photo cleanup failed', e))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('inventoryPage.toastBulkDeleted', { n: selectedIds.size }))
      setSelectedIds(new Set())
    },
    onError: () => toast.error(t('inventoryPage.toastDeleteError')),
  })

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    const ok = await showConfirm({
      message: t('inventoryPage.confirmBulkDelete', { count }),
      danger: true,
    })
    if (!ok) return
    bulkDeleteMutation.mutate(Array.from(selectedIds))
  }

  const handleDelete = async (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const message = item.status === 'sold'
      ? t('inventoryPage.confirmDeleteSold')
      : t('inventoryPage.confirmDelete')
    const ok = await showConfirm({ message, danger: true })
    if (!ok) return
    deleteMutation.mutate(item)
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div ref={rootRef} className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title={i18n.t('cabinet:nav.stock')}
        subtitle={totalCount > inventory.length
          ? t('inventoryPage.subtitleOf', { loaded: inventory.length, total: totalCount })
          : t('inventoryPage.subtitleTotal', { loaded: inventory.length, total: totalCount })}
        backPath="/parts/dashboard"
        actions={
          <>
            <button
              onClick={() => navigate(`/parts/inventory/new?source=${addSource}&bulk=1`)}
              className="cab-btn cab-btn-secondary cab-btn-sm flex items-center gap-1.5"
              title={t('inventoryPage.addBulk')}
            >
              <Layers className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('inventoryPage.addBulk')}</span>
            </button>
            <button
              onClick={() => navigate(`/parts/inventory/new?source=${addSource}`)}
              className="cab-btn cab-btn-primary cab-btn-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span>{t('inventoryPage.add')}</span>
            </button>
          </>
        }
      />

      {/* Content */}
      <div className="page-container">
        {/* Limit reached banner */}
        {!canCreate.part() && limits.maxParts !== null && (
          <div className="mb-4">
            <LimitReachedBanner
              used={usage.parts}
              max={limits.maxParts}
              label={t('inventoryPage.partsLabel')}
              ctaHref="/parts/subscription"
            />
          </div>
        )}

        {/* Лимит фото по тарифу: предупреждение с 90% */}
        <div className="mb-4 empty:hidden">
          <PhotoLimitNotice companyId={partsCompanyId} />
        </div>

        {/* Источник: Все / С авто / Магазин (остальные фильтры не сбрасываются) */}
        <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label={t('inventoryPage.sourceLabel')}>
          {(['all', 'vehicles', 'shop'] as const).map(src => (
            <button
              key={src}
              type="button"
              onClick={() => setUrlParam('source', src === 'all' ? null : src)}
              aria-pressed={sourceFilter === src}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md whitespace-nowrap transition-colors ${sourceFilter === src ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t(src === 'all' ? 'inventoryPage.sourceAll' : src === 'vehicles' ? 'inventoryPage.sourceVehicles' : 'inventoryPage.sourceShop')}
            </button>
          ))}
        </div>

        {/* Быстрые фильтры (серверные, в URL: ?filter=) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 mb-3 scrollbar-hide">
          {([
            [undefined, t('inventoryPage.quickAll'), null],
            ['noPrice', t('inventoryPage.quickNoPrice'), summary?.needsFill ?? null],
            ['noPhoto', t('inventoryPage.quickNoPhoto'), summary?.noPhoto ?? null],
            ['noLocation', t('inventoryPage.quickNoLocation'), null],
            ['stale', t('inventoryPage.quickStale'), null],
          ] as const).map(([key, label, count]) => (
            <button
              key={key ?? 'all'}
              type="button"
              onClick={() => { if (key) setStatusFilter('all'); setUrlParam('filter', key ?? null) }}
              aria-pressed={quickFilter === key}
              className={`chip flex-shrink-0 whitespace-nowrap ${quickFilter === key ? 'chip-active' : ''}`}
            >
              {label}{count ? ` (${count})` : ''}
            </button>
          ))}
        </div>

        {/* Status chips + cost line. Суммы стоимости — только на десктопе (sm+);
            на мобиле они засоряли интерфейс, статистика видна в других местах. */}
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* Chip-фильтры по статусу */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0 scrollbar-hide">
            <button
              onClick={() => setStatusFilter('all')}
              className={`chip flex-shrink-0 ${statusFilter === 'all' ? 'chip-active' : ''}`}
            >
              {t('inventoryPage.chipAll')} ({sourceFilter === 'shop' ? stats.totalQuantity : stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('available')}
              className={`chip flex-shrink-0 ${statusFilter === 'available' ? 'chip-active' : ''}`}
            >
              {t('inventoryPage.chipAvailable')} ({stats.available})
            </button>
            <button
              onClick={() => setStatusFilter('reserved')}
              className={`chip flex-shrink-0 ${statusFilter === 'reserved' ? 'chip-active' : ''}`}
            >
              {t('inventoryPage.chipReserved')} ({stats.reserved})
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'sold' ? 'all' : 'sold')}
              className={`chip flex-shrink-0 ${statusFilter === 'sold' ? 'chip-active' : ''}`}
            >
              {t('inventoryPage.chipSold')} ({stats.sold})
            </button>
          </div>
          {/* Стоимость — скрыта на мобиле (только sm+) */}
          <div className="flex-shrink-0 text-right hidden sm:block">
            {statusFilter === 'all' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 hidden sm:inline">{t('inventoryPage.costStock')}</span>
                <span className="text-sm font-bold text-green-600">
                  {stockUSD === 0 ? '—' : `$${Math.round(stockUSD).toLocaleString(intlLocale())}`}
                </span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500 hidden sm:inline">{t('inventoryPage.costSold')}</span>
                <span className="text-sm font-bold text-primary">
                  {soldUSD === 0 ? '—' : `$${Math.round(soldUSD).toLocaleString(intlLocale())}`}
                </span>
              </div>
            ) : statusFilter === 'available' || statusFilter === 'reserved' ? (
              <span className="text-sm font-bold text-green-600">
                {stockUSD === 0 ? '—' : `$${Math.round(stockUSD).toLocaleString(intlLocale())}`}
              </span>
            ) : statusFilter === 'sold' ? (
              <span className="text-sm font-bold text-primary">
                {soldUSD === 0 ? '—' : `$${Math.round(soldUSD).toLocaleString(intlLocale())}`}
              </span>
            ) : (
              <span className="text-sm font-bold text-primary">
                {stockUSD === 0 ? '—' : `$${Math.round(stockUSD).toLocaleString(intlLocale())}`}
              </span>
            )}
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="cab-card p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder={t('inventoryPage.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
              {/* Телефон: остальные фильтры спрятаны за кнопкой */}
              <button
                type="button"
                onClick={() => setFiltersOpen(v => !v)}
                aria-expanded={filtersOpen}
                className={`md:hidden flex-shrink-0 inline-flex items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${filtersOpen || activeFiltersCount > 0 ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-600'}`}
              >
                <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
                {t('inventoryPage.filters')}
                {activeFiltersCount > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-md bg-gray-900 text-white text-[11px] font-semibold tabular-nums inline-flex items-center justify-center">{activeFiltersCount}</span>
                )}
              </button>
            </div>

            <div className={`${filtersOpen ? 'flex' : 'hidden'} flex-col sm:flex-row sm:flex-wrap gap-3 md:contents`}>

            {/* Фильтр по разделу маркета (серверный) */}
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="form-select sm:w-48"
              aria-label={t('inventoryPage.sectionFilter')}
            >
              <option value="all">{t('inventoryPage.allSections')}</option>
              {sections.map(s => (
                <option key={s.slug} value={s.slug}>{marketSectionName(s, i18n.language)}</option>
              ))}
              <option value="none">{t('inventoryPage.marketSectionNone')}</option>
            </select>

            {/* Фильтр по ячейке склада */}
            {(storageLocations as StorageLocation[]).length > 0 && (
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="form-select sm:w-56"
                aria-label={t('inventoryPage.locationFilter')}
              >
                <option value="all">{t('inventoryPage.allLocations')}</option>
                {buildLocationOptions(storageLocations as StorageLocation[]).map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2">
              {/* Сортировка — кнопки-чипы (как чипы статусов). Тап по активному чипу
                  переключает направление (↑/↓). Не сокращаем: на мобиле скрыт только
                  «Статус»; «Дата»/«Название»/«Цена» — всегда. */}
              <div className="flex items-center gap-1.5 min-w-0">
                {([['date', t('inventoryPage.sortDate')], ['name', t('inventoryPage.sortName')], ['status', t('inventoryPage.sortStatus')], ['price', t('inventoryPage.sortPrice')]] as const).map(([field, label]) => (
                  <button
                    key={field}
                    onClick={() => {
                      if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      // дата по умолчанию — новые сверху (desc); остальные — по возрастанию (asc)
                      else { setSortField(field); setSortDir(field === 'date' ? 'desc' : 'asc') }
                    }}
                    title={field === 'date' ? t('inventoryPage.sortDateTitle') : field === 'name' ? t('inventoryPage.sortNameTitle') : field === 'status' ? t('inventoryPage.sortStatusTitle') : t('inventoryPage.sortPriceTitle')}
                    className={`chip flex-shrink-0 ${field === 'status' ? 'hidden sm:inline-flex' : ''} ${sortField === field ? 'chip-active' : ''}`}
                  >
                    {label}
                    {sortField === field && (
                      sortDir === 'asc'
                        ? <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
                        : <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
                    )}
                  </button>
                ))}
              </div>

              {/* Плитка/список — на мобиле прижаты вправо */}
              <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 flex-shrink-0 ml-auto sm:ml-0">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  title={t('inventoryPage.viewList')}
                  aria-label={t('inventoryPage.viewList')}
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  title={t('inventoryPage.viewGrid')}
                  aria-label={t('inventoryPage.viewGrid')}
                  aria-pressed={viewMode === 'grid'}
                >
                  <Grid className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            </div>
          </div>

          {/* Vehicle filter — only in Разборка mode with 2+ vehicles */}
          {showVehicleButtons && (
            <div className={`mt-3 flex-wrap gap-1.5 md:flex ${filtersOpen ? 'flex' : 'hidden'}`}>
              <button
                onClick={() => setVehicleFilter('all')}
                className={`chip ${effectiveVehicleFilter === 'all' ? 'chip-active' : ''}`}
              >
                {t('inventoryPage.allVehicles')}
              </button>
              {uniqueVehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleFilter(vehicleFilter === v.id ? 'all' : v.id)}
                  className={`chip ${effectiveVehicleFilter === v.id ? 'chip-active' : ''}`}
                >
                  {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Inventory List/Grid */}
        {isError ? (
          <QueryState isError onRetry={() => { void refetch() }}>{null}</QueryState>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="cab-card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Package className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
              </div>
              <p className="empty-state-title">
                {debouncedSearch || statusFilter !== 'all' ? t('inventoryPage.emptyNotFound') : t('inventoryPage.emptyNoParts')}
              </p>
              {!debouncedSearch && statusFilter === 'all' && (
                <button
                  onClick={() => navigate(`/parts/inventory/new?source=${addSource}`)}
                  className="mt-3 cab-btn cab-btn-ghost cab-btn-sm text-primary"
                >
                  {t('inventoryPage.addFirst')}
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
            {filteredAndSorted.map((item) => (
              <div key={item.id} className="cv-card">
                <InventoryCard
                  item={item}
                  statusFilter={statusFilter}
                  selectedIds={selectedIds}
                  onStatusClick={handleStatusClick}
                  onEdit={handleEdit}
                  onSell={handleSell}
                  onDelete={handleDelete}
                  onNavigate={goToItem}
                  onToggleSelect={(id, e) => toggleSelect(id, e as React.MouseEvent)}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
          {/* Мобильный компактный список — название · ориг. номер · цена (всё остальное в карточке) */}
          <div className="cab-card p-0 overflow-hidden md:hidden divide-y divide-gray-100">
            {filteredAndSorted.map((item) => (
              <button
                key={item.id}
                onClick={() => goToItem(item.id)}
                className="cv-row w-full flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-slate-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 flex items-start gap-1.5">
                    {!((item.photos as ImgbbPhoto[] | undefined)?.length) && (
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" strokeWidth={2} aria-label={t('inventoryPage.noPhotoMark')} />
                    )}
                    <span className="line-clamp-2 break-words">{item.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span className="font-mono truncate max-w-[40%]">{item.part_number || t('inventoryPage.noNumber')}</span>
                    <span className="text-sm font-bold text-primary tabular whitespace-nowrap">
                      {item.selling_price
                        ? formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')
                        : <span className="text-amber-500 text-xs font-semibold">{t('inventoryPage.noPrice')}</span>}
                    </span>
                    {(item.storage_location?.id || item.storage_location?.name) ? (
                      <span className="inline-flex items-center gap-1 max-w-full rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700">
                        <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{(item.storage_location?.id && locationLabelById.get(item.storage_location.id)) || item.storage_location?.name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-dashed border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-400 whitespace-nowrap">
                        {t('inventoryPage.noLocation')}
                      </span>
                    )}
                    {item.status !== 'available' && (
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">{statusLabel(item.status as PartsInventoryStatus)}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
              </button>
            ))}
          </div>

          {/* Таблица — планшет/десктоп */}
          <div className="cab-card p-0 overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[640px]">
                <thead>
                  <tr>
                    <th className="table-header-cell !px-2" style={{ width: '38px' }}></th>
                    <th className="table-header-cell !px-2" style={{ width: '26%' }}>{t('inventoryPage.colName')}</th>
                    <th className="table-header-cell !px-2 hidden sm:table-cell" style={{ width: '15%' }}>{t('inventoryPage.colOem')}</th>
                    <th className="table-header-cell !px-2 whitespace-nowrap" style={{ width: '9%' }}>{t('inventoryPage.colPrice')}</th>
                    <th className="table-header-cell !px-2 whitespace-nowrap" style={{ width: '13%' }}>{t('inventoryPage.colStatus')}</th>
                    <th className="table-header-cell !px-2 hidden lg:table-cell" style={{ width: '14%' }}>{t('inventoryPage.colVehicle')}</th>
                    <th className="table-header-cell !px-2 hidden xl:table-cell" style={{ width: '11%' }}>{t('inventoryPage.colCategory')}</th>
                    <th className="table-header-cell !px-2 whitespace-nowrap" style={{ width: '12%' }}>{t('inventoryPage.colStorage')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSorted.map((item) => (
                    <tr
                      key={item.id}
                      className="cv-row hover:bg-slate-50 transition-colors group/row cursor-pointer"
                      onClick={() => goToItem(item.id)}
                    >
                      {/* Выбор */}
                      <td className="w-8 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(item.id, e) }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                      {/* Название */}
                      <td className="px-2 py-2">
                        <div className="font-semibold text-gray-900 group-hover/row:text-primary transition-colors truncate flex items-center gap-1.5">
                          {!((item.photos as ImgbbPhoto[] | undefined)?.length) && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" strokeWidth={2} aria-label={t('inventoryPage.noPhotoMark')} />
                          )}
                          <span className="truncate">{item.name}</span>
                        </div>
                      </td>
                      {/* Оригинальный номер */}
                      <td className="hidden sm:table-cell px-2 py-2 text-sm text-gray-500 font-mono truncate">
                        {item.part_number || <span className="text-gray-300">—</span>}
                      </td>
                      {/* Цена */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="text-sm font-bold text-primary tabular text-right">
                          {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                        </span>
                      </td>
                      {/* Наличие — статус + кол-во */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusClick(item, e) }}
                          className={`${statusColors[item.status]} cursor-pointer hover:opacity-80 transition-opacity`}
                        >
                          {statusLabel(item.status)}
                        </button>
                        {!item.vehicle_id && (
                          <span className={`ml-1.5 text-xs font-semibold tabular ${item.quantity <= 2 ? 'text-red-600' : 'text-gray-500'}`}>
                            {t('inventoryPage.qtyPcs', { n: item.quantity })}{item.quantity <= 2 && item.status === 'available'
                              ? <AlertTriangle className="inline w-3 h-3 ml-0.5 -mt-0.5 text-red-500" />
                              : null}
                          </span>
                        )}
                      </td>
                      {/* Авто */}
                      <td className="hidden lg:table-cell px-2 py-2 text-sm text-gray-700">
                        {item.vehicle ? (
                          <div className="leading-tight min-w-0">
                            <div className="text-sm font-medium text-gray-700 truncate">{item.vehicle.make} {item.vehicle.model}</div>
                            {item.vehicle.year && <div className="text-[11px] text-gray-500">{item.vehicle.year}</div>}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{t('inventoryPage.shopLabel')}</span>
                        )}
                      </td>
                      {/* Категория */}
                      <td className="hidden xl:table-cell px-2 py-2 text-sm text-gray-600">
                        <div className="truncate">
                          {item.market_category && sectionByslug.get(item.market_category)
                            ? marketSectionName(sectionByslug.get(item.market_category)!, i18n.language)
                            : <span className="text-gray-300">—</span>}
                        </div>
                        {item.category && <div className="truncate text-[11px] text-gray-400">{item.category.name}</div>}
                      </td>
                      {/* Склад */}
                      <td className="px-2 py-2 text-sm text-gray-600 whitespace-nowrap">
                        <div className="truncate">
                          {item.storage_location?.name || item.location || <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {/* Load more */}
        {hasNextPage && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-sm text-gray-400">
              {t('inventoryPage.loadedOf', { loaded: inventory.length, total: totalCount })}
            </span>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="cab-btn cab-btn-secondary cab-btn-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isFetchingNextPage ? <Spinner size="sm" /> : null}
              {isFetchingNextPage ? t('inventoryPage.loading') : t('inventoryPage.loadMore')}
            </button>
          </div>
        )}
      </div>

      {/* Status Picker Modal */}
      {statusPickerItem && (
        <div className="modal-overlay">
          <div className="absolute inset-0" onClick={() => { setStatusPickerItem(null); setPendingStatus(null) }} />
          <div className="modal-sheet sm:max-w-xs w-full z-10">
            <div className="modal-handle sm:hidden" />
            {pendingStatus ? (
              <>
                <div className="modal-header">
                  <h3 className="text-base font-bold text-gray-900">{t('inventoryPage.confirmChange')}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{statusPickerItem.name}</p>
                </div>
                <div className="modal-body">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className={`badge ${statusColors[statusPickerItem.status]}`}>
                      {statusLabel(statusPickerItem.status)}
                    </span>
                    <span className="text-gray-400 text-sm">→</span>
                    <span className={`badge ${statusColors[pendingStatus]}`}>
                      {statusLabel(pendingStatus)}
                    </span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button onClick={() => setPendingStatus(null)} className="modal-btn-cancel">
                    {t('inventoryPage.back')}
                  </button>
                  <button
                    disabled={statusChangeMutation.isPending}
                    onClick={() => {
                      statusChangeMutation.mutate(
                        { id: statusPickerItem.id, status: pendingStatus },
                        { onSuccess: () => { setStatusPickerItem(null); setPendingStatus(null) } }
                      )
                    }}
                    className="cab-btn cab-btn-primary disabled:opacity-50"
                  >
                    {statusChangeMutation.isPending ? t('inventoryPage.saving') : t('inventoryPage.confirm')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h3 className="text-base font-bold text-gray-900">{t('inventoryPage.changeStatus')}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{statusPickerItem.name}</p>
                </div>
                <div className="modal-body space-y-2">
                  {(Object.keys(statusColors) as PartsInventoryStatus[]).map(s => (
                    <button
                      key={s}
                      disabled={s === statusPickerItem.status}
                      onClick={() => setPendingStatus(s)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        s === statusPickerItem.status
                          ? `${statusColors[s]} opacity-70 cursor-default`
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700 active:bg-gray-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        s === 'available' ? 'bg-green-500' :
                        s === 'reserved' ? 'bg-yellow-500' :
                        s === 'sold' ? 'bg-gray-400' : 'bg-red-500'
                      }`} />
                      {statusLabel(s)}
                      {s === statusPickerItem.status && (
                        <span className="ml-auto text-xs font-normal text-gray-400">{t('inventoryPage.statusCurrent')}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="modal-footer">
                  <button
                    onClick={() => setStatusPickerItem(null)}
                    className="modal-btn-cancel w-full"
                  >
                    {t('inventoryPage.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(1rem+64px+env(safe-area-inset-bottom,0px))] md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center gap-2 bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-lg animate-slide-up max-w-[calc(100vw-2rem)]">
          <span className="text-sm font-semibold whitespace-nowrap">
            {t('inventoryPage.selectedCount', { n: selectedIds.size })}
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-white transition-colors text-xs font-medium underline whitespace-nowrap"
          >
            {t('inventoryPage.reset')}
          </button>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={openBulkSell}
              aria-label={t('inventoryPage.sell')}
              className="cab-btn cab-btn-success cab-btn-sm flex items-center gap-1.5"
            >
              <DollarSign className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('inventoryPage.sell')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setBulkLocationId(''); setIsBulkLocationOpen(true) }}
              aria-label={t('inventoryPage.location')}
              className="cab-btn cab-btn-secondary cab-btn-sm"
            >
              <MapPin className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('inventoryPage.location')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setBulkCategoryId(''); setIsBulkCategoryOpen(true) }}
              aria-label={t('inventoryPage.category')}
              className="cab-btn cab-btn-secondary cab-btn-sm"
            >
              <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('inventoryPage.category')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setBulkSection('auto'); setIsBulkSectionOpen(true) }}
              aria-label={t('inventoryPage.changeSection')}
              className="cab-btn cab-btn-secondary cab-btn-sm"
            >
              <Tag className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('inventoryPage.section')}</span>
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              aria-label={t('inventoryPage.delete')}
              disabled={bulkDeleteMutation.isPending}
              className="cab-btn cab-btn-danger cab-btn-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('inventoryPage.delete')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Единая форма продажи */}
      {saleSheet && (
        <SaleSheet
          open
          onClose={() => setSaleSheet(null)}
          source={saleSheet.source}
          initialItems={saleSheet.items}
          onDone={() => { if (saleSheet.source === 'stock-bulk') setSelectedIds(new Set()) }}
        />
      )}

      {/* Bulk Location Modal */}
      {isBulkLocationOpen && (
        <div className="modal-overlay">
          <div onClick={() => setIsBulkLocationOpen(false)} className="absolute inset-0" />
          <div className="modal-sheet sm:max-w-xs w-full z-10">
            <div className="modal-handle sm:hidden" />
            <div className="modal-header">
              <h3 className="text-base font-bold text-gray-900">{t('inventoryPage.changeLocation')}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{t('inventoryPage.forNItems', { n: selectedIds.size })}</p>
            </div>
            <div className="modal-body">
              <label className="form-label">{t('inventoryPage.storageLocation')}</label>
              {storageLocations.length > 0 ? (
                <div className="relative">
                  <select
                    value={bulkLocationId}
                    onChange={(e) => setBulkLocationId(e.target.value)}
                    className="form-select"
                    autoFocus
                  >
                    <option value="">{t('inventoryPage.notSpecifiedDash')}</option>
                    {buildLocationOptions(storageLocations as StorageLocation[]).map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">{t('inventoryPage.noLocationsConfigured')}</p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setIsBulkLocationOpen(false)} className="modal-btn-cancel">
                {t('inventoryPage.cancel')}
              </button>
              <button
                type="button"
                disabled={bulkLocationMutation.isPending}
                onClick={() => bulkLocationMutation.mutate({
                  ids: Array.from(selectedIds),
                  locationId: bulkLocationId || null,
                })}
                className="cab-btn cab-btn-primary disabled:opacity-50"
              >
                {bulkLocationMutation.isPending ? t('inventoryPage.saving') : t('inventoryPage.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Market Section Modal */}
      {isBulkSectionOpen && (
        <div className="modal-overlay">
          <div onClick={() => setIsBulkSectionOpen(false)} className="absolute inset-0" />
          <div className="modal-sheet sm:max-w-xs w-full z-10" role="dialog" aria-modal="true" aria-labelledby="bulk-section-title">
            <div className="modal-handle sm:hidden" />
            <div className="modal-header">
              <h3 id="bulk-section-title" className="text-base font-bold text-gray-900">{t('inventoryPage.changeSection')}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{t('inventoryPage.forNItems', { n: selectedIds.size })}</p>
            </div>
            <div className="modal-body">
              <label className="form-label" htmlFor="bulk-section-select">{t('inventoryPage.marketSection')}</label>
              <select
                id="bulk-section-select"
                value={bulkSection}
                onChange={(e) => setBulkSection(e.target.value)}
                className="form-select"
                autoFocus
              >
                <option value="auto">{t('inventoryPage.marketSectionAuto')}</option>
                {sections.map(s => (
                  <option key={s.slug} value={s.slug}>{marketSectionName(s, i18n.language)}</option>
                ))}
                <option value="none">{t('inventoryPage.marketSectionNone')}</option>
              </select>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setIsBulkSectionOpen(false)} className="modal-btn-cancel">
                {t('inventoryPage.cancel')}
              </button>
              <button
                type="button"
                disabled={bulkSectionMutation.isPending}
                onClick={() => bulkSectionMutation.mutate({ ids: Array.from(selectedIds), section: bulkSection })}
                className="cab-btn cab-btn-primary disabled:opacity-50"
              >
                {bulkSectionMutation.isPending ? t('inventoryPage.saving') : t('inventoryPage.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Category Modal */}
      {isBulkCategoryOpen && (
        <div className="modal-overlay">
          <div onClick={() => setIsBulkCategoryOpen(false)} className="absolute inset-0" />
          <div className="modal-sheet sm:max-w-xs w-full z-10">
            <div className="modal-handle sm:hidden" />
            <div className="modal-header">
              <h3 className="text-base font-bold text-gray-900">{t('inventoryPage.changeCategory')}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{t('inventoryPage.forNItems', { n: selectedIds.size })}</p>
            </div>
            <div className="modal-body">
              <label className="form-label">{t('inventoryPage.category')}</label>
              <div className="relative">
                <select
                  value={bulkCategoryId}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                  className="form-select"
                  autoFocus
                >
                  <option value="">{t('inventoryPage.noCategoryDash')}</option>
                  {(categories as CategoryDropdownRow[]).map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setIsBulkCategoryOpen(false)} className="modal-btn-cancel">
                {t('inventoryPage.cancel')}
              </button>
              <button
                type="button"
                disabled={bulkCategoryMutation.isPending}
                onClick={() => bulkCategoryMutation.mutate({
                  ids: Array.from(selectedIds),
                  categoryId: bulkCategoryId || null,
                })}
                className="cab-btn cab-btn-primary disabled:opacity-50"
              >
                {bulkCategoryMutation.isPending ? t('inventoryPage.saving') : t('inventoryPage.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Добавление/редактирование запчасти — на отдельной странице (PartsInventoryEdit) */}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
