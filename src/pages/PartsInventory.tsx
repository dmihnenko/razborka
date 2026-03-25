import { useState, useEffect } from 'react'
import { Plus, Search, Package, Grid, List, ArrowLeft, AlertTriangle, TrendingDown, Box, Camera, X, Tag, ClipboardList, Trash2, DollarSign, UserPlus, ChevronDown } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsInventory, createPartsInventoryItem, updatePartsInventoryItem, deletePartsInventoryItem, getStorageLocations, getPartsCustomers, createPartsCustomer, createPartsOrder, createPartsOrderItem, updatePartsOrderTotal } from '@/services/partsService'
import type { PartsInventoryItem, CreatePartsInventoryInput, PartsInventoryStatus, StorageLocation, PartsCustomer } from '@/types/parts'
import type { ImgbbPhoto } from '@/services/imgbbService'
import { uploadToImgbb, deletePhotosFromImgbb } from '@/services/imgbbService'
import { getImgbbKey } from '@/utils/imgbbKey'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/utils/currency'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type ViewMode = 'grid' | 'list'

interface BulkRow {
  item: PartsInventoryItem
  quantity: number
  price: string
  currency: 'UAH' | 'USD'
}

const statusLabels: Record<PartsInventoryStatus, string> = {
  available: 'В наличии',
  reserved: 'Зарезервировано',
  sold: 'Продано',
  damaged: 'Повреждено'
}

const statusColors: Record<PartsInventoryStatus, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  sold: 'bg-gray-100 text-gray-800 border-gray-200',
  damaged: 'bg-red-100 text-red-800 border-red-200'
}

const conditionLabels = {
  new: 'Новая',
  used: 'Б/У хорошее',
  damaged: 'Повреждена'
}

export default function PartsInventory() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sourceFilter = searchParams.get('source') ?? 'vehicles' // 'vehicles' | 'shop'
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [vehicleFilter, setVehicleFilter] = useState<string>('all') // vehicle_id or 'all'
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 'list' : 'grid'
  )
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PartsInventoryItem | null>(null)
  const [sellingItem, setSellingItem] = useState<PartsInventoryItem | null>(null)
  const [sellPrice, setSellPrice] = useState('')
  const [sellCurrency, setSellCurrency] = useState<'UAH' | 'USD'>('USD')
  const [sellCustomerId, setSellCustomerId] = useState<string>('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [lastVehicleId, setLastVehicleId] = useState<string>(
    () => sessionStorage.getItem('parts_last_vehicle_id') || ''
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkSellOpen, setIsBulkSellOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])
  const [bulkCustomerId, setBulkCustomerId] = useState<string>('')
  const [bulkShowNewCustomer, setBulkShowNewCustomer] = useState(false)
  const [bulkNewCustomerName, setBulkNewCustomerName] = useState('')
  const [bulkNewCustomerPhone, setBulkNewCustomerPhone] = useState('')
  const [statusPickerItem, setStatusPickerItem] = useState<PartsInventoryItem | null>(null)

  const { data: profile } = useUserProfile()
  const { rate: usdRate } = usePartsExchangeRate()
  const queryClient = useQueryClient()
  const partsCompanyId = profile?.parts_company_id

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['parts-inventory', partsCompanyId],
    queryFn: () => getPartsInventory(partsCompanyId!),
    enabled: !!partsCompanyId
  })

  // Auto-open edit modal when navigated back with editItemId in state
  useEffect(() => {
    const editItemId = location.state?.editItemId
    if (editItemId && inventory.length > 0) {
      const found = inventory.find((i: PartsInventoryItem) => i.id === editItemId)
      if (found) {
        setEditingItem(found)
        setIsModalOpen(true)
        // Clear state so it doesn't reopen on re-render
        window.history.replaceState({}, '')
      }
    }
  }, [location.state, inventory])

  // Reset status filter when switching between Разборка / Магазин
  useEffect(() => {
    setStatusFilter('all')
    setSearchQuery('')
    setVehicleFilter('all')
    setSelectedIds(new Set())
  }, [sourceFilter])

  // Clear selection when leaving reserved filter
  useEffect(() => {
    if (statusFilter !== 'reserved') {
      setSelectedIds(new Set())
    }
  }, [statusFilter])

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

  // Get vehicles for dropdown in modal
  const { data: vehicles = [] } = useQuery({
    queryKey: ['parts-vehicles-dropdown', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_vehicles')
        .select('id, make, model, year')
        .eq('parts_company_id', partsCompanyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId && isModalOpen
  })

  // Get storage locations for dropdown in modal
  const { data: storageLocations = [] } = useQuery({
    queryKey: ['parts-storage-locations', partsCompanyId],
    queryFn: () => getStorageLocations(partsCompanyId!),
    enabled: !!partsCompanyId && isModalOpen,
  })

  // Get customers for sell modal
  const { data: customers = [] } = useQuery<PartsCustomer[]>({
    queryKey: ['parts-customers', partsCompanyId],
    queryFn: () => getPartsCustomers(partsCompanyId!),
    enabled: !!partsCompanyId && (!!sellingItem || isBulkSellOpen),
  })

  const saveMutation = useMutation({
    mutationFn: async (data: CreatePartsInventoryInput) => {
      if (editingItem) {
        return updatePartsInventoryItem(editingItem.id, data)
      } else {
        return createPartsInventoryItem(data, partsCompanyId!)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(editingItem ? 'Запчасть обновлена' : 'Запчасть добавлена')
      setIsModalOpen(false)
      setEditingItem(null)
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    }
  })

  const saveBulkMutation = useMutation({
    mutationFn: async (items: CreatePartsInventoryInput[]) => {
      for (const item of items) {
        await createPartsInventoryItem(item, partsCompanyId!)
      }
    },
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(`Добавлено ${items.length} запчастей`)
      setIsModalOpen(false)
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (item: PartsInventoryItem) => {
      if (item.photos?.length) {
        await deletePhotosFromImgbb(item.photos as ImgbbPhoto[])
      }
      await deletePartsInventoryItem(item.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Запчасть удалена')
    },
    onError: (error: any) => {
      if (error?.status === 409 || error?.code === '23503') {
        toast.error('Нельзя удалить: запчасть входит в заказ. Сначала удалите её из заказа.')
      } else {
        toast.error('Ошибка при удалении')
      }
    }
  })

  // Filter by source first (for stats and list)
  const inventoryBySource = inventory.filter((item: PartsInventoryItem) =>
    sourceFilter === 'all' ||
    (sourceFilter === 'vehicles' && !!item.vehicle_id) ||
    (sourceFilter === 'shop' && !item.vehicle_id)
  )

  // Unique vehicles from current source for filter buttons
  const uniqueVehicles = sourceFilter === 'vehicles'
    ? Array.from(
        new Map(
          inventoryBySource
            .filter((i: PartsInventoryItem) => i.vehicle_id && i.vehicle)
            .map((i: PartsInventoryItem) => [i.vehicle_id, i.vehicle])
        ).entries()
      ).map(([id, v]) => ({ id, ...(v as any) }))
    : []

  // If only one vehicle exists — apply it automatically, hide buttons
  const singleVehicle = uniqueVehicles.length === 1 ? uniqueVehicles[0] : null
  const effectiveVehicleFilter = singleVehicle ? singleVehicle.id : vehicleFilter
  const showVehicleButtons = uniqueVehicles.length > 1

  // Filter inventory
  const filteredInventory = inventoryBySource.filter((item: PartsInventoryItem) => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.part_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    const matchesVehicle = effectiveVehicleFilter === 'all' || item.vehicle_id === effectiveVehicleFilter
    
    return matchesSearch && matchesStatus && matchesVehicle
  })

  // Statistics — scoped to current source section
  const stats = {
    total: inventoryBySource.length,
    totalQuantity: inventoryBySource.reduce((sum: number, item: PartsInventoryItem) => sum + item.quantity, 0),
    available: inventoryBySource.filter((i: PartsInventoryItem) => i.status === 'available').length,
    reserved: inventoryBySource.filter((i: PartsInventoryItem) => i.status === 'reserved').length,
    sold: inventoryBySource.filter((i: PartsInventoryItem) => i.status === 'sold').length,
    lowStock: inventoryBySource.filter((i: PartsInventoryItem) => !i.vehicle_id && i.quantity <= 2 && i.status === 'available').length,
    noPrice: inventoryBySource.filter((i: PartsInventoryItem) => !i.selling_price).length,
    totalUAH: inventoryBySource.reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.status === 'sold' ? (item.sold_price ?? item.selling_price ?? 0) : (item.selling_price || 0)
      return item.price_currency === 'UAH' ? sum + price * item.quantity : sum
    }, 0),
    totalUSD: inventoryBySource.reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.status === 'sold' ? (item.sold_price ?? item.selling_price ?? 0) : (item.selling_price || 0)
      return (item.price_currency === 'USD' || !item.price_currency) ? sum + price * item.quantity : sum
    }, 0),
    availableUSD: inventoryBySource.filter((i: PartsInventoryItem) => i.status === 'available').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.selling_price || 0
      return (item.price_currency === 'USD' || !item.price_currency) ? sum + price * item.quantity : sum + price * item.quantity / (usdRate || 41)
    }, 0),
    reservedUSD: inventoryBySource.filter((i: PartsInventoryItem) => i.status === 'reserved').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.selling_price || 0
      return (item.price_currency === 'USD' || !item.price_currency) ? sum + price * item.quantity : sum + price * item.quantity / (usdRate || 41)
    }, 0),
    stockUSD: inventoryBySource.filter((i: PartsInventoryItem) => i.status === 'available' || i.status === 'reserved').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.selling_price || 0
      return (item.price_currency === 'USD' || !item.price_currency) ? sum + price * item.quantity : sum + price * item.quantity / (usdRate || 41)
    }, 0),
    soldUSD: inventoryBySource.filter((i: PartsInventoryItem) => i.status === 'sold').reduce((sum: number, item: PartsInventoryItem) => {
      const price = item.sold_price ?? item.selling_price ?? 0
      return (item.price_currency === 'USD' || !item.price_currency) ? sum + price * item.quantity : sum + price * item.quantity / (usdRate || 41)
    }, 0),
  }

  const sellMutation = useMutation({
    mutationFn: async ({ item, price, currency, customerId, newCustomer }: {
      item: PartsInventoryItem
      price: number
      currency: 'UAH' | 'USD'
      customerId?: string
      newCustomer?: { name: string; phone: string }
    }) => {
      let resolvedCustomerId: string | null = customerId || null

      // Create new customer if provided
      if (newCustomer?.name?.trim()) {
        const created = await createPartsCustomer(
          { full_name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || undefined },
          partsCompanyId!
        )
        resolvedCustomerId = created.id
      }

      // Create order
      const order = await createPartsOrder(partsCompanyId!, {
        customer_id: resolvedCustomerId,
        order_date: new Date().toISOString(),
      })

      // Add item to order
      await createPartsOrderItem(order.id, {
        inventory_item_id: item.id,
        quantity: 1,
        price_at_sale: price,
        price_at_sale_currency: currency,
      })

      // Update order total with current exchange rate
      await updatePartsOrderTotal(order.id, usdRate)

      // Complete the order — trigger complete_parts_order() sets inventory status='sold' and decrements quantity
      const { error: completeError } = await supabase
        .from('parts_orders')
        .update({ status: 'completed', exchange_rate_at_sale: usdRate })
        .eq('id', order.id)
      if (completeError) throw completeError

      // Only update fields not handled by the trigger (sold_price currency, customer link)
      return updatePartsInventoryItem(item.id, {
        sold_price: price,
        price_currency: currency,
        sold_to_customer_id: resolvedCustomerId || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      toast.success('Запчасть продана, заказ создан')
      setSellingItem(null)
      setSellPrice('')
      setSellCustomerId('')
      setShowNewCustomer(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
    },
    onError: (err: any) => {
      console.error('Sell error:', err)
      const msg = err?.message || err?.error_description || JSON.stringify(err)
      toast.error(`Ошибка при сохранении: ${msg}`)
    },
  })

  const bulkSellMutation = useMutation({
    mutationFn: async ({ rows, customerId, newCustomer }: {
      rows: BulkRow[]
      customerId?: string
      newCustomer?: { name: string; phone: string }
    }) => {
      let resolvedCustomerId: string | null = customerId || null
      if (newCustomer?.name?.trim()) {
        const created = await createPartsCustomer(
          { full_name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || undefined },
          partsCompanyId!
        )
        resolvedCustomerId = created.id
      }
      const order = await createPartsOrder(partsCompanyId!, {
        customer_id: resolvedCustomerId,
        order_date: new Date().toISOString(),
      })
      for (const row of rows) {
        await createPartsOrderItem(order.id, {
          inventory_item_id: row.item.id,
          quantity: row.quantity,
          price_at_sale: parseFloat(row.price) || 0,
          price_at_sale_currency: row.currency,
        })
      }
      await updatePartsOrderTotal(order.id, usdRate)
      const { error: completeError } = await supabase
        .from('parts_orders')
        .update({ status: 'completed', exchange_rate_at_sale: usdRate })
        .eq('id', order.id)
      if (completeError) throw completeError
      for (const row of rows) {
        await updatePartsInventoryItem(row.item.id, {
          sold_price: parseFloat(row.price) || undefined,
          price_currency: row.currency,
          sold_to_customer_id: resolvedCustomerId || undefined,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      toast.success(`Продано ${bulkRows.length} запч., заказ создан`)
      setIsBulkSellOpen(false)
      setSelectedIds(new Set())
      setBulkRows([])
      setBulkCustomerId('')
      setBulkShowNewCustomer(false)
      setBulkNewCustomerName('')
      setBulkNewCustomerPhone('')
    },
    onError: (err: any) => {
      console.error('Bulk sell error:', err)
      const msg = err?.message || err?.error_description || JSON.stringify(err)
      toast.error(`Ошибка при продаже: ${msg}`)
    },
  })

  const toggleSelect = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openBulkSell = () => {
    const items = filteredInventory.filter((i: PartsInventoryItem) => selectedIds.has(i.id))
    setBulkRows(items.map((item: PartsInventoryItem) => ({
      item,
      quantity: 1,
      price: item.selling_price ? String(item.selling_price) : '',
      currency: (item.price_currency as 'UAH' | 'USD') || 'USD',
    })))
    setBulkCustomerId('')
    setBulkShowNewCustomer(false)
    setBulkNewCustomerName('')
    setBulkNewCustomerPhone('')
    setIsBulkSellOpen(true)
  }

  const handleEdit = (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleSell = (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setSellingItem(item)
    setSellPrice(item.selling_price ? String(item.selling_price) : '')
    setSellCurrency((item.price_currency as 'UAH' | 'USD') || 'USD')
    setSellCustomerId('')
    setShowNewCustomer(false)
    setNewCustomerName('')
    setNewCustomerPhone('')
  }

  const statusChangeMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PartsInventoryStatus }) =>
      updatePartsInventoryItem(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Статус обновлён')
    },
    onError: () => toast.error('Ошибка при изменении статуса'),
  })

  const handleStatusClick = (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setStatusPickerItem(item)
  }

  const handleDelete = async (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const message = item.status === 'sold'
      ? 'Удалить проданную запчасть? Она будет убрана из заказа, а сумма заказа пересчитается. Если это единственная позиция — заказ удалится.'
      : 'Удалить запчасть? Это действие нельзя отменить.'
    const ok = await showConfirm({ message, danger: true })
    if (!ok) return
    deleteMutation.mutate(item)
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">У вас нет доступа к разборке</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row */}
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => navigate('/parts')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {sourceFilter === 'shop' ? 'Магазин' : 'Запчасти'}
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">Всего: {stats.total} позиций</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setEditingItem(null)
                  setIsModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Добавить</span>
              </button>
            </div>
          </div>


        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* No-price banner */}
        {stats.noPrice > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-800">
                <span className="font-semibold">{stats.noPrice}</span>
                {' '}запчаст{stats.noPrice === 1 ? 'ь' : stats.noPrice < 5 ? 'и' : 'ей'} без цены
              </span>
            </div>
            <button
              onClick={() => navigate('/parts/inventory/no-price')}
              className="flex-shrink-0 px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              Заполнить
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'all' ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Всего</p>
              <Box className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{sourceFilter === 'vehicles' ? stats.total : stats.totalQuantity}</p>
            <p className="text-xs text-gray-500 mt-1">{sourceFilter === 'vehicles' ? 'наименований' : `${stats.total} наименований`}</p>
          </button>

          <button
            onClick={() => setStatusFilter('available')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'available' ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">В наличии</p>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.available}</p>
          </button>

          <button
            onClick={() => setStatusFilter('reserved')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'reserved' ? 'ring-2 ring-yellow-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Зарезервировано</p>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{stats.reserved}</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'sold' ? 'all' : 'sold')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'sold' ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Продано</p>
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.sold}</p>
          </button>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Стоимость</p>
              <TrendingDown className="w-4 h-4 text-blue-500" />
            </div>
            {statusFilter === 'all' ? (
              <>
                <p className="text-xs text-gray-500 mb-0.5">В наличии</p>
                <p className="text-base sm:text-lg font-bold text-green-600">
                  {stats.stockUSD === 0 ? '—' : `$${Math.round(stats.stockUSD).toLocaleString('ru-RU')}`}
                </p>
                <p className="text-xs text-gray-500 mt-1.5 mb-0.5">Продано</p>
                <p className="text-base sm:text-lg font-bold text-blue-600">
                  {stats.soldUSD === 0 ? '—' : `$${Math.round(stats.soldUSD).toLocaleString('ru-RU')}`}
                </p>
              </>
            ) : statusFilter === 'available' || statusFilter === 'reserved' ? (
              <p className="text-lg sm:text-xl font-bold text-green-600">
                {stats.stockUSD === 0 ? '—' : `$${Math.round(stats.stockUSD).toLocaleString('ru-RU')}`}
              </p>
            ) : statusFilter === 'sold' ? (
              <p className="text-lg sm:text-xl font-bold text-blue-600">
                {stats.soldUSD === 0 ? '—' : `$${Math.round(stats.soldUSD).toLocaleString('ru-RU')}`}
              </p>
            ) : (
              <p className="text-lg sm:text-xl font-bold text-blue-600">
                {stats.totalUAH === 0 && stats.totalUSD === 0 ? '—' : `$${Math.round(stats.totalUSD + stats.totalUAH / (usdRate || 41)).toLocaleString('ru-RU')}`}
              </p>
            )}
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию, артикулу, описанию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                title="Список (таблица)"
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                title="Карточки"
              >
                <Grid className="w-5 h-5" />
              </button>
            </div>
          </div>

          {statusFilter !== 'all' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Фильтр: <span className="font-medium">{statusLabels[statusFilter as PartsInventoryStatus]}</span>
              </span>
              <button
                onClick={() => setStatusFilter('all')}
                className="ml-2 text-sm text-primary hover:underline"
              >
                Сбросить
              </button>
            </div>
          )}

          {/* Vehicle filter — only in Разборка mode with 2+ vehicles */}
          {showVehicleButtons && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setVehicleFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  effectiveVehicleFilter === 'all'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary'
                }`}
              >
                Все машины
              </button>
              {uniqueVehicles.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleFilter(vehicleFilter === v.id ? 'all' : v.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    effectiveVehicleFilter === v.id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary'
                  }`}
                >
                  {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Inventory List/Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'Запчасти не найдены' : 'Нет запчастей'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-primary hover:underline"
              >
                Добавить первую запчасть
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden group flex flex-col"
              >
                <div className="p-5 flex-1">
                  {/* Status & Low Stock Warning */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {statusFilter === 'reserved' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(item.id, e) }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-yellow-500 cursor-pointer flex-shrink-0"
                        />
                      )}
                      <div className="relative group/status">
                        <button
                          onClick={(e) => handleStatusClick(item, e)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border hover:opacity-80 transition-opacity cursor-pointer ${statusColors[item.status]}`}
                        >
                          {statusLabels[item.status]}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.vehicle && (
                        <span className="text-xs text-gray-500 font-medium truncate max-w-[120px]">
                          {item.vehicle.make} {item.vehicle.model} {item.vehicle.year}
                        </span>
                      )}
                      {!item.vehicle_id && item.quantity <= 2 && item.status === 'available' && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs font-medium">Мало</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Part Info */}
                  <div className="mb-4">
                    <h3
                      className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors line-clamp-2 cursor-pointer hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); navigate(`/parts/inventory/${item.id}`) }}
                    >
                      {item.name}
                    </h3>
                    {item.part_number && (
                      <p className="text-sm text-gray-600">Арт: {item.part_number}</p>
                    )}
                    {item.category && (
                      <p className="text-xs text-gray-500 mt-1">{item.category.name}</p>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Состояние:</span>
                      <span className="font-medium">{conditionLabels[item.condition as keyof typeof conditionLabels]}</span>
                    </div>
                    {!item.vehicle_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Количество:</span>
                        <span className={`font-bold ${item.quantity <= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                          {item.quantity} шт
                        </span>
                      </div>
                    )}
                    {item.selling_price && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-600">Цена:</span>
                        <span className="font-bold text-primary text-lg">{formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}</span>
                      </div>
                    )}
                    {item.status === 'sold' && item.sold_to_customer && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-600">Покупатель:</span>
                        <span className="font-medium text-gray-900 truncate ml-2">{item.sold_to_customer.full_name}</span>
                      </div>
                    )}
                    {item.status === 'sold' && item.sold_price && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Продано за:</span>
                        <span className="font-bold text-green-700">{formatPrice(item.sold_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}</span>
                      </div>
                    )}
                  </div>

                  {item.location && (
                    <div className="text-xs text-gray-500 mb-3">
                      📍 {item.location}
                    </div>
                  )}

                  {item.description && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="bg-gray-50 px-4 py-3 flex gap-2">
                  <button
                    onClick={(e) => handleEdit(item, e)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Редактировать
                  </button>
                  {item.status !== 'sold' && (
                    <button
                      onClick={(e) => handleSell(item, e)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
                    >
                      <DollarSign className="w-4 h-4" />
                      Продать
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(item, e)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className={`px-3 py-3 w-8${statusFilter !== 'reserved' ? ' hidden' : ''}`}></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Запчасть
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Категория
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                      Артикул
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Машина
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Статус
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell${sourceFilter === 'vehicles' ? ' !hidden' : ''}`}>
                      Кол-во
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Цена
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInventory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/40 transition-colors group/row cursor-pointer"
                      onClick={() => navigate(`/parts/inventory/${item.id}`)}
                    >
                      <td
                        className={`px-3 py-3 w-8${statusFilter !== 'reserved' ? ' hidden' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusFilter === 'reserved' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(item.id, e) }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 accent-yellow-500 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900 group-hover/row:text-primary transition-colors leading-tight">
                            {item.name}
                          </div>
                          {item.category && (
                            <div className="text-xs text-gray-400 mt-0.5 md:hidden">{item.category.name}</div>
                          )}
                          {item.location && (
                            <div className="text-xs text-gray-400 mt-0.5">📍 {item.location}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {item.category ? (
                          <span className="text-sm text-gray-600">{item.category.name}</span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono hidden xl:table-cell">
                        {item.part_number || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {item.vehicle ? (
                          <div>
                            <div className="text-sm font-medium text-gray-700">{item.vehicle.make} {item.vehicle.model}</div>
                            <div className="text-xs text-gray-400">{item.vehicle.year} · {item.vehicle.vin?.slice(-6) ?? ''}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Магазин</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                        <button
                          onClick={(e) => handleStatusClick(item, e)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${statusColors[item.status]}`}
                        >
                          {statusLabels[item.status]}
                        </button>
                        {item.status === 'sold' && item.sold_to_customer && (
                          <div className="text-xs text-blue-600 mt-1 font-medium truncate max-w-[120px]">
                            {item.sold_to_customer.full_name}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap hidden sm:table-cell${sourceFilter === 'vehicles' ? ' !hidden' : ''}`}>
                        {item.vehicle_id ? (
                          <span className="text-sm text-gray-300">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold ${item.quantity <= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                              {item.quantity}
                            </span>
                            {item.reserved_quantity > 0 && (
                              <span className="text-xs text-yellow-600 font-medium">({item.reserved_quantity} рез.)</span>
                            )}
                            {item.quantity <= 2 && item.status === 'available' && (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-primary">
                          {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEdit(item, e)}
                            className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {item.status !== 'sold' && (
                            <button
                              onClick={(e) => handleSell(item, e)}
                              className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Продать"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDelete(item, e)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Status Picker Modal */}
      {statusPickerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setStatusPickerItem(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xs p-5 z-10">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Изменить статус</h3>
            <p className="text-sm text-gray-500 mb-4 line-clamp-1">{statusPickerItem.name}</p>
            <div className="space-y-2">
              {(Object.keys(statusLabels) as PartsInventoryStatus[]).map(s => (
                <button
                  key={s}
                  disabled={s === statusPickerItem.status || statusChangeMutation.isPending}
                  onClick={() => {
                    if (s === statusPickerItem.status) return
                    statusChangeMutation.mutate(
                      { id: statusPickerItem.id, status: s },
                      { onSuccess: () => setStatusPickerItem(null) }
                    )
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    s === statusPickerItem.status
                      ? `${statusColors[s]} opacity-60 cursor-default`
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    s === 'available' ? 'bg-green-500' :
                    s === 'reserved' ? 'bg-yellow-500' :
                    s === 'sold' ? 'bg-gray-400' : 'bg-red-500'
                  }`} />
                  {statusLabels[s]}
                  {s === statusPickerItem.status && (
                    <span className="ml-auto text-xs text-gray-400">Текущий</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStatusPickerItem(null)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Bulk Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white rounded-xl px-5 py-3 shadow-2xl">
          <span className="text-sm font-medium">
            Выбрано: {selectedIds.size} запч.
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-white transition-colors text-xs underline"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={openBulkSell}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Продать
          </button>
        </div>
      )}

      {/* Sell Modal */}
      {sellingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSellingItem(null)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 z-10">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Продать запчасть</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{sellingItem.name}</p>

              {/* Price */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена продажи</label>
              {sellingItem.selling_price && (
                <p className="text-xs text-gray-400 mb-2">Объявленная: {formatPrice(sellingItem.selling_price, (sellingItem.price_currency as 'UAH' | 'USD') || 'USD')}</p>
              )}
              <div className="flex gap-2 mb-4">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setSellCurrency(c => c === 'USD' ? 'UAH' : 'USD')}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 w-12 text-center"
                >
                  {sellCurrency === 'USD' ? '$' : '₴'}
                </button>
              </div>

              {/* Customer selection */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Клиент <span className="text-gray-400 font-normal">(необязательно)</span></label>
              {!showNewCustomer ? (
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <select
                      value={sellCustomerId}
                      onChange={(e) => setSellCustomerId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary appearance-none pr-8"
                    >
                      <option value="">— Без клиента —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}{c.phone ? ` (${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 flex-shrink-0"
                    title="Новый клиент"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Новый клиент</span>
                    <button type="button" onClick={() => setShowNewCustomer(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Имя *"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Телефон"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSellingItem(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={sellMutation.isPending}
                  onClick={() => {
                    const price = parseFloat(sellPrice)
                    if (isNaN(price) || price < 0) {
                      toast.error('Введите корректную сумму')
                      return
                    }
                    if (showNewCustomer && !newCustomerName.trim()) {
                      toast.error('Введите имя клиента')
                      return
                    }
                    sellMutation.mutate({
                      item: sellingItem,
                      price,
                      currency: sellCurrency,
                      customerId: sellCustomerId || undefined,
                      newCustomer: showNewCustomer ? { name: newCustomerName, phone: newCustomerPhone } : undefined,
                    })
                  }}
                  className="flex-1 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
                >
                  {sellMutation.isPending ? 'Сохранение...' : 'Продать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Sell Modal */}
      {isBulkSellOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 py-8">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setIsBulkSellOpen(false)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 z-10">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Продать зарезервированные запчасти</h3>
              <p className="text-sm text-gray-500 mb-4">Укажите количество и цену продажи для каждой позиции</p>

              {/* Items list */}
              <div className="space-y-3 mb-5 max-h-64 overflow-y-auto pr-1">
                {bulkRows.map((row, idx) => (
                  <div key={row.item.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{row.item.name}</p>
                      {row.item.part_number && (
                        <p className="text-xs text-gray-400">{row.item.part_number}</p>
                      )}
                    </div>
                    {/* Quantity */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">кол:</span>
                      <input
                        type="number"
                        min="1"
                        max={row.item.quantity}
                        value={row.quantity}
                        onChange={(e) => {
                          const next = [...bulkRows]
                          next[idx] = { ...next[idx], quantity: Math.max(1, Math.min(row.item.quantity, parseInt(e.target.value) || 1)) }
                          setBulkRows(next)
                        }}
                        className="w-14 px-2 py-1 text-sm border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {/* Price */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => {
                          const next = [...bulkRows]
                          next[idx] = { ...next[idx], price: e.target.value }
                          setBulkRows(next)
                        }}
                        placeholder="Цена"
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...bulkRows]
                          next[idx] = { ...next[idx], currency: row.currency === 'USD' ? 'UAH' : 'USD' }
                          setBulkRows(next)
                        }}
                        className="px-2 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 w-9 text-center"
                      >
                        {row.currency === 'USD' ? '$' : '₴'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer */}
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Клиент <span className="text-gray-400 font-normal">(необязательно)</span>
              </label>
              {!bulkShowNewCustomer ? (
                <div className="flex gap-2 mb-5">
                  <div className="relative flex-1">
                    <select
                      value={bulkCustomerId}
                      onChange={(e) => setBulkCustomerId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary appearance-none pr-8"
                    >
                      <option value="">— Без клиента —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}{c.phone ? ` (${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkShowNewCustomer(true)}
                    className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 flex-shrink-0"
                    title="Новый клиент"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Новый клиент</span>
                    <button type="button" onClick={() => setBulkShowNewCustomer(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={bulkNewCustomerName}
                    onChange={(e) => setBulkNewCustomerName(e.target.value)}
                    placeholder="Имя *"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    value={bulkNewCustomerPhone}
                    onChange={(e) => setBulkNewCustomerPhone(e.target.value)}
                    placeholder="Телефон"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkSellOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={bulkSellMutation.isPending}
                  onClick={() => {
                    for (const row of bulkRows) {
                      const price = parseFloat(row.price)
                      if (isNaN(price) || price < 0) {
                        toast.error(`Укажите цену для: ${row.item.name}`)
                        return
                      }
                    }
                    if (bulkShowNewCustomer && !bulkNewCustomerName.trim()) {
                      toast.error('Введите имя клиента')
                      return
                    }
                    bulkSellMutation.mutate({
                      rows: bulkRows,
                      customerId: bulkCustomerId || undefined,
                      newCustomer: bulkShowNewCustomer ? { name: bulkNewCustomerName, phone: bulkNewCustomerPhone } : undefined,
                    })
                  }}
                  className="flex-1 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
                >
                  {bulkSellMutation.isPending ? 'Сохранение...' : `Продать (${bulkRows.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <PartsInventoryModal
          item={editingItem}
          categories={categories}
          vehicles={vehicles}
          storageLocations={storageLocations as StorageLocation[]}
          onClose={() => {
            setIsModalOpen(false)
            setEditingItem(null)
          }}
          onSave={(data) => saveMutation.mutate(data)}
          onSaveBulk={(items) => saveBulkMutation.mutate(items)}
          isSaving={saveMutation.isPending || saveBulkMutation.isPending}
          initialVehicleId={editingItem ? undefined : lastVehicleId}
          onVehicleChange={(id) => {
            setLastVehicleId(id)
            if (id) {
              sessionStorage.setItem('parts_last_vehicle_id', id)
            } else {
              sessionStorage.removeItem('parts_last_vehicle_id')
            }
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

// Parse pasted text into BulkRow[]. Columns separated by tab.
// Skips blank lines and lines with no meaningful name.
// 4th column (optional): status keywords
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
      return { name, selling_price: price, part_number: oem, status }
    })
    .filter(r => r.name && !/^[-\s=]+$/.test(r.name))
}

// Build flat option list with indentation for storage location select
function buildLocationOptions(locations: StorageLocation[]): { id: string; label: string }[] {
  const map = new Map<string, StorageLocation>()
  locations.forEach(l => map.set(l.id, l))

  function getPath(id: string): string {
    const node = map.get(id)
    if (!node) return ''
    if (!node.parent_id) return node.name
    return getPath(node.parent_id) + ' → ' + node.name
  }

  return locations.map(l => ({ id: l.id, label: getPath(l.id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Module-level helper — used by both main component and modal
function getCategoriesForVehicle(vehicleId: string, vehicles: any[], categories: any[]) {
  const vehicle = vehicles.find(v => v.id === vehicleId)
  if (!vehicle) return categories
  const make = (vehicle.make || '').toLowerCase()
  const relevantCats = categories.filter((cat: any) =>
    !cat.brand || cat.brand.toLowerCase() === make
  )
  return relevantCats.length > 0 ? relevantCats : categories
}

// Modal Component
interface ModalBulkRow {
  name: string
  selling_price: string
  part_number: string
  status: PartsInventoryStatus
}

interface PartsInventoryModalProps {
  item: PartsInventoryItem | null
  categories: any[]
  vehicles: any[]
  storageLocations: StorageLocation[]
  onClose: () => void
  onSave: (data: CreatePartsInventoryInput) => void
  onSaveBulk?: (items: CreatePartsInventoryInput[]) => void
  isSaving?: boolean
  initialVehicleId?: string
  onVehicleChange?: (id: string) => void
}

export function PartsInventoryModal({ item, categories, vehicles, storageLocations, onClose, onSave, onSaveBulk, isSaving, initialVehicleId, onVehicleChange }: PartsInventoryModalProps) {
  const [bulkMode, setBulkMode] = useState(false)
  const [showPasteArea, setShowPasteArea] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [bulkItems, setBulkItems] = useState<ModalBulkRow[]>([{ name: '', selling_price: '', part_number: '', status: 'available' }])
  const autoFilledVehicle = !item && !!initialVehicleId
  const [autoHintDismissed, setAutoHintDismissed] = useState(false)
  const [bulkShared, setBulkShared] = useState({
    category_id: '',
    vehicle_id: initialVehicleId || '',
    condition: 'used',
    storage_location_id: '',
    price_currency: 'USD' as 'UAH' | 'USD',
  })

  const [formData, setFormData] = useState<CreatePartsInventoryInput>({
    category_id: item?.category_id || '',
    vehicle_id: item?.vehicle_id || initialVehicleId || '',
    name: item?.name || '',
    part_number: item?.part_number || '',
    description: item?.description || '',
    condition: item?.condition || 'used',
    quantity: item?.quantity || 1,
    selling_price: item?.selling_price || undefined,
    price_currency: (item?.price_currency as 'UAH' | 'USD') || 'USD',
    location: item?.location || '',
    shelf: item?.shelf || '',
    bin: item?.bin || '',
    notes: item?.notes || '',
    storage_location_id: (item as any)?.storage_location_id || '',
  })
  const [photos, setPhotos] = useState<ImgbbPhoto[]>((item?.photos as ImgbbPhoto[]) || [])
  const [uploading, setUploading] = useState(false)

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const apiKey = getImgbbKey()
    if (!apiKey) {
      toast.error('Укажите API ключ ImgBB в Настройках')
      return
    }
    setUploading(true)
    try {
      const uploaded: ImgbbPhoto[] = []
      for (const file of files) {
        const photo = await uploadToImgbb(file, apiKey)
        uploaded.push(photo)
      }
      setPhotos(prev => [...prev, ...uploaded])
      toast.success(`${uploaded.length} фото загружено`)
    } catch {
      toast.error('Ошибка загрузки фото')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (bulkMode) {
      const valid = bulkItems.filter(r => r.name.trim())
      if (!valid.length) {
        toast.error('Добавьте хотя бы одну запчасть с названием')
        return
      }
      onSaveBulk?.(valid.map(r => ({
        name: r.name.trim(),
        selling_price: Number(r.selling_price) || undefined,
        part_number: r.part_number.trim() || undefined,
        category_id: bulkShared.category_id || undefined,
        vehicle_id: bulkShared.vehicle_id || undefined,
        condition: bulkShared.condition,
        storage_location_id: bulkShared.storage_location_id || undefined,
        price_currency: bulkShared.price_currency,
        quantity: 1,
        photos: [],
        status: r.status,
      })))
    } else {
      onSave({ ...formData, photos })
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-t-2xl sm:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {item ? 'Редактировать запчасть' : 'Добавить запчасть'}
              </h3>

              {/* Auto-filled vehicle reminder */}
              {autoFilledVehicle && !autoHintDismissed && (() => {
                const v = (vehicles as any[]).find(x => x.id === (bulkMode ? bulkShared.vehicle_id : formData.vehicle_id))
                if (!v) return null
                return (
                  <div className="flex items-center justify-between gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <span>
                      Авто-выбрано последнее: <strong>{v.make} {v.model} {v.year}</strong>
                    </span>
                    <button type="button" onClick={() => setAutoHintDismissed(true)} className="text-amber-500 hover:text-amber-700 text-xs underline shrink-0">
                      Ок
                    </button>
                  </div>
                )
              })()}

              {!item && (
                <div className="flex mb-5 bg-gray-100 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                      !bulkMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Одна запчасть
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode(true)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                      bulkMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Списком
                  </button>
                </div>
              )}

              {bulkMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Автомобиль-источник</label>
                      <select
                        value={bulkShared.vehicle_id}
                        onChange={(e) => {
                        setBulkShared({ ...bulkShared, vehicle_id: e.target.value, category_id: '' })
                        onVehicleChange?.(e.target.value)
                      }}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Не привязано</option>
                        {(vehicles as any[]).map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.make} {vehicle.model} {vehicle.year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                      <select
                        value={bulkShared.category_id}
                        onChange={(e) => setBulkShared({ ...bulkShared, category_id: e.target.value })}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Без категории</option>
                        {(bulkShared.vehicle_id
                          ? getCategoriesForVehicle(bulkShared.vehicle_id, vehicles, categories)
                          : categories
                        ).map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Состояние</label>
                      <select
                        value={bulkShared.condition}
                        onChange={(e) => setBulkShared({ ...bulkShared, condition: e.target.value })}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="new">Новая</option>
                        <option value="used">Б/У хорошее</option>
                        <option value="damaged">Повреждена</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Место хранения</label>
                      {storageLocations.length > 0 ? (
                        <select
                          value={bulkShared.storage_location_id}
                          onChange={(e) => setBulkShared({ ...bulkShared, storage_location_id: e.target.value })}
                          className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Не указано</option>
                          {buildLocationOptions(storageLocations).map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Например: Бокс 1, Полка 3..."
                          className="w-full px-3 py-2 text-base border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
                          disabled
                        />
                      )}
                    </div>
                  </div>

                  {/* Bulk items table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Список запчастей
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasteArea(v => !v)
                            setPasteText('')
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            showPasteArea
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          Вставить списком
                        </button>
                        <span className="text-xs text-gray-500">Валюта:</span>
                        <button
                          type="button"
                          onClick={() => setBulkShared(prev => ({ ...prev, price_currency: prev.price_currency === 'USD' ? 'UAH' : 'USD' }))}
                          className="px-3 py-1 rounded text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
                          title="Сменить валюту"
                        >
                          {bulkShared.price_currency === 'USD' ? '$' : '₴'}
                        </button>
                      </div>
                    </div>

                    {/* Paste area */}
                    {showPasteArea && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700 mb-2">
                          Вставьте список в формате: <span className="font-mono font-semibold">Название [Tab] Цена [Tab] Ориг.номер [Tab] Статус</span><br />
                          Цена, номер и статус — необязательны. Статус: <span className="font-mono">бронь / продано / повреждено</span> — остальное → в наличии.
                        </p>
                        <textarea
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          rows={6}
                          placeholder={'Капот\t800\t\t\nКрыло\t650\t1234567-00-A\nПанорама\t750\t\tБронь\nДверь передняя\t\t\tПродано'}
                          className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono resize-none bg-white"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-blue-600">
                            {pasteText.trim() ? `${parseBulkText(pasteText).length} строк распознано` : ''}
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
                            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
                          >
                            Применить
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="grid gap-0 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 border-b border-gray-200" style={{ gridTemplateColumns: '1fr 80px 110px 108px 32px' }}>
                        <span>Название *</span>
                        <span>Цена</span>
                        <span>Ориг. номер</span>
                        <span>Статус</span>
                        <span></span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {bulkItems.map((row, idx) => (
                          <div key={idx} className="grid gap-0 items-center px-3 py-1.5" style={{ gridTemplateColumns: '1fr 80px 110px 108px 32px' }}>
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => {
                                const next = [...bulkItems]
                                next[idx] = { ...next[idx], name: e.target.value }
                                setBulkItems(next)
                              }}
                              placeholder="Название"
                              className="w-full pr-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0"
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
                              className="w-full pr-2 py-1.5 text-sm border-0 border-l border-gray-200 pl-2 focus:outline-none focus:ring-0"
                            />
                            <input
                              type="text"
                              value={row.part_number}
                              onChange={(e) => {
                                const next = [...bulkItems]
                                next[idx] = { ...next[idx], part_number: e.target.value }
                                setBulkItems(next)
                              }}
                              placeholder="Ориг. номер"
                              className="w-full pr-2 py-1.5 text-sm border-0 border-l border-gray-200 pl-2 focus:outline-none focus:ring-0"
                            />
                            <select
                              value={row.status}
                              onChange={(e) => {
                                const next = [...bulkItems]
                                next[idx] = { ...next[idx], status: e.target.value as PartsInventoryStatus }
                                setBulkItems(next)
                              }}
                              className={`w-full py-1.5 text-xs border-0 border-l border-gray-200 pl-2 pr-1 focus:outline-none focus:ring-0 font-medium ${
                                row.status === 'available' ? 'text-green-700 bg-green-50' :
                                row.status === 'reserved' ? 'text-yellow-700 bg-yellow-50' :
                                row.status === 'sold'     ? 'text-gray-500 bg-gray-50' :
                                                            'text-red-700 bg-red-50'
                              }`}
                            >
                              <option value="available">В наличии</option>
                              <option value="reserved">Бронь</option>
                              <option value="sold">Продано</option>
                              <option value="damaged">Повреждено</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (bulkItems.length > 1) setBulkItems(prev => prev.filter((_, i) => i !== idx))
                              }}
                              className="flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkItems(prev => [...prev, { name: '', selling_price: '', part_number: '', status: 'available' }])}
                      className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить строку
                    </button>
                  </div>
                </div>
              ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Автомобиль-источник
                    </label>
                    <select
                      value={formData.vehicle_id || ''}
                      onChange={(e) => {
                        const newVehicleId = e.target.value || undefined
                        setFormData({ ...formData, vehicle_id: newVehicleId, category_id: '' })
                        if (newVehicleId) onVehicleChange?.(newVehicleId)
                        else onVehicleChange?.('')
                      }}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Не привязано к автомобилю</option>
                      {(vehicles as any[]).map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.make} {vehicle.model} {vehicle.year}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Укажите автомобиль, из которого снята эта запчасть
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Категория
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Без категории</option>
                      {(formData.vehicle_id
                        ? getCategoriesForVehicle(formData.vehicle_id, vehicles, categories)
                        : categories
                      ).map((cat: any) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Артикул
                    </label>
                    <input
                      type="text"
                      value={formData.part_number}
                      onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Состояние *
                    </label>
                    <select
                      required
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="new">Новая</option>
                      <option value="used">Б/У хорошее</option>
                      <option value="damaged">Повреждена</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {!formData.vehicle_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Цена</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.selling_price || ''}
                        onChange={(e) => setFormData({ ...formData, selling_price: e.target.value ? Number(e.target.value) : undefined })}
                        className="flex-1 min-w-0 px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, price_currency: formData.price_currency === 'USD' ? 'UAH' : 'USD' })}
                        className="px-3 py-2 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors flex-shrink-0 w-10 text-center"
                        title="Сменить валюту"
                      >
                        {formData.price_currency === 'USD' ? '$' : '₴'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sold toggle button — only when creating */}
                {!item && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: formData.status === 'sold' ? 'available' : 'sold' })}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      formData.status === 'sold'
                        ? 'bg-gray-800 border-gray-800 text-white'
                        : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {formData.status === 'sold' ? '✓ Продано' : 'Отметить как продано'}
                  </button>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Место хранения</label>
                  {storageLocations.length > 0 ? (
                    <select
                      value={formData.storage_location_id || ''}
                      onChange={(e) => setFormData({ ...formData, storage_location_id: e.target.value || undefined })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Не указано</option>
                      {buildLocationOptions(storageLocations).map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={formData.location || ''}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Например: Бокс 1, Полка 3..."
                        className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Фотографии</label>
                  <label className={`flex items-center justify-center gap-2 w-full h-11 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                    uploading ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-primary hover:bg-primary/5'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploading}
                      onChange={handlePhotoSelect}
                      className="sr-only"
                    />
                    <Camera className={`w-4 h-4 ${uploading ? 'text-gray-300' : 'text-gray-500'}`} />
                    <span className={`text-sm ${uploading ? 'text-gray-400' : 'text-gray-600'}`}>
                      {uploading ? 'Загрузка...' : 'Добавить фото'}
                    </span>
                  </label>
                  {photos.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {photos.map((photo, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={photo.thumb_url || photo.url}
                            alt={`Фото ${i + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
              )}
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving
                  ? 'Сохранение...'
                  : bulkMode
                    ? `Добавить ${bulkItems.filter(r => r.name.trim()).length || ''} запчастей`
                    : item ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
