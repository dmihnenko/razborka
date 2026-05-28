import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { Save, Tag, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsInventory, updatePartsInventoryItem, getStorageLocations } from '@/services/partsService'
import type { PartsInventoryItem, StorageLocation } from '@/types/parts'
import { supabase } from '@/lib/supabase'

interface RowEdit {
  selling_price: string
  price_currency: 'USD' | 'UAH'
  part_number: string
  category_id: string
  storage_location_id: string
  description: string
}

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

export default function PartsNoPricePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const [editState, setEditState] = useState<Record<string, RowEdit>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['parts-inventory', partsCompanyId],
    queryFn: () => getPartsInventory(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['parts-categories', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_categories')
        .select('id, name')
        .eq('parts_company_id', partsCompanyId)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId,
  })

  const { data: storageLocations = [] } = useQuery({
    queryKey: ['parts-storage-locations', partsCompanyId],
    queryFn: () => getStorageLocations(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const noPriceItems: PartsInventoryItem[] = inventory.filter((i: PartsInventoryItem) => !i.selling_price)

  // Initialize edit state for each no-price item
  useEffect(() => {
    setEditState(prev => {
      const next = { ...prev }
      noPriceItems.forEach(item => {
        if (!next[item.id]) {
          next[item.id] = {
            selling_price: '',
            price_currency: (item.price_currency as 'USD' | 'UAH') || 'USD',
            part_number: item.part_number || '',
            category_id: item.category_id || '',
            storage_location_id: (item as any).storage_location_id || '',
            description: item.description || '',
          }
        }
      })
      return next
    })
  }, [inventory])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PartsInventoryItem> }) =>
      updatePartsInventoryItem(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      setSaved(prev => new Set([...prev, id]))
      toast.success('Запчасть обновлена')
    },
    onError: () => toast.error('Ошибка при сохранении'),
  })

  const handleSave = (item: PartsInventoryItem) => {
    const row = editState[item.id]
    if (!row) return
    const updates: Partial<PartsInventoryItem> = {
      price_currency: row.price_currency,
    }
    if (row.selling_price) updates.selling_price = Number(row.selling_price)
    if (row.part_number.trim()) updates.part_number = row.part_number.trim()
    if (row.category_id) updates.category_id = row.category_id
    if (row.storage_location_id) (updates as any).storage_location_id = row.storage_location_id
    if (row.description.trim()) updates.description = row.description.trim()
    updateMutation.mutate({ id: item.id, data: updates })
  }

  const setField = (id: string, field: keyof RowEdit, value: string) => {
    setEditState(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
    setSaved(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Нет доступа к разборке</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title="Запчасти без цены"
        subtitle={!isLoading ? `${noPriceItems.length} позиций требуют заполнения` : undefined}
        backPath="/parts/inventory"
        maxWidth="4xl"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="text-center py-16">
            <Spinner size="md" className="inline-block" />
          </div>
        ) : noPriceItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-1">Всё заполнено!</p>
            <p className="text-gray-500 mb-6">У всех запчастей указана цена.</p>
            <button
              onClick={() => navigate('/parts/inventory')}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              На склад
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {noPriceItems.map(item => {
              const row = editState[item.id]
              if (!row) return null
              const isExpanded = expanded.has(item.id)
              const isSaved = saved.has(item.id)
              const isSaving = updateMutation.isPending && updateMutation.variables?.id === item.id

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl shadow-sm border transition-all ${
                    isSaved ? 'border-green-300' : 'border-gray-200'
                  }`}
                >
                  {/* Item header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">{item.name}</span>
                        {item.part_number && (
                          <span className="text-xs text-gray-400 font-mono">{item.part_number}</span>
                        )}
                        {item.category && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {item.category.name}
                          </span>
                        )}
                        {isSaved && (
                          <span className="text-xs flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Сохранено
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.quantity} шт · {item.condition === 'new' ? 'Новая' : item.condition === 'used' ? 'Б/У' : 'Повреждена'}
                      </p>
                    </div>

                    {/* Price + currency inline */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="flex items-center gap-0 border border-amber-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
                        <Tag className="w-3.5 h-3.5 text-amber-500 ml-2 flex-shrink-0" />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.selling_price}
                          onChange={(e) => setField(item.id, 'selling_price', e.target.value)}
                          placeholder="Цена"
                          className="w-24 pl-1.5 pr-1 py-1.5 text-sm border-0 focus:outline-none focus:ring-0 bg-amber-50"
                        />
                        <button
                          type="button"
                          onClick={() => setField(item.id, 'price_currency', row.price_currency === 'USD' ? 'UAH' : 'USD')}
                          className="px-2 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border-l border-amber-300"
                        >
                          {row.price_currency === 'USD' ? '$' : '₴'}
                        </button>
                      </div>
                    </div>

                    {/* Expand / save buttons */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      title="Доп. поля"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSave(item)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isSaving ? 'Сохр...' : 'Сохранить'}</span>
                    </button>
                  </div>

                  {/* Expanded: extra fields */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-b-xl">
                      {/* Part number */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Оригинальный номер</label>
                        <input
                          type="text"
                          value={row.part_number}
                          onChange={(e) => setField(item.id, 'part_number', e.target.value)}
                          placeholder="Не указан"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Категория</label>
                        <select
                          value={row.category_id}
                          onChange={(e) => setField(item.id, 'category_id', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                        >
                          <option value="">Без категории</option>
                          {categories.map((cat: any) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Storage location */}
                      {storageLocations.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Место хранения</label>
                          <select
                            value={row.storage_location_id}
                            onChange={(e) => setField(item.id, 'storage_location_id', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          >
                            <option value="">Не указано</option>
                            {buildLocationOptions(storageLocations as StorageLocation[]).map(opt => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Description */}
                      <div className={storageLocations.length > 0 ? '' : 'sm:col-span-2'}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Описание</label>
                        <textarea
                          value={row.description}
                          onChange={(e) => setField(item.id, 'description', e.target.value)}
                          placeholder="Не указано"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
