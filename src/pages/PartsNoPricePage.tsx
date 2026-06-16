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
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="empty-state">
          <p className="empty-state-title">Нет доступа к разборке</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-950">
      <PartsPageHeader
        title="Запчасти без цены"
        subtitle={!isLoading ? `${noPriceItems.length} позиций требуют заполнения` : undefined}
        backPath="/parts/inventory"
        maxWidth="4xl"
      />

      <div className="w-full py-4 sm:py-6">
        {isLoading ? (
          <div className="empty-state">
            <Spinner size="md" className="inline-block" />
          </div>
        ) : noPriceItems.length === 0 ? (
          /* ── Empty state ── */
          <div className="cab-card p-12">
            <div className="empty-state">
              <div className="empty-state-icon">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="empty-state-title">Всё заполнено!</p>
              <p className="empty-state-text">У всех запчастей указана цена.</p>
              <button
                onClick={() => navigate('/parts/inventory')}
                className="cab-btn cab-btn-primary mt-6"
              >
                На склад
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Desktop table (hidden on mobile) ── */}
            <div className="cab-card hidden sm:block overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="table-header-cell">Название</th>
                    <th className="table-header-cell">Кол-во / Сост.</th>
                    <th className="table-header-cell w-52">Цена</th>
                    <th className="table-header-cell w-10"></th>
                    <th className="table-header-cell w-28"></th>
                  </tr>
                </thead>
                <tbody className="grid-hairline">
                  {noPriceItems.map(item => {
                    const row = editState[item.id]
                    if (!row) return null
                    const isExpanded = expanded.has(item.id)
                    const isSaved = saved.has(item.id)
                    const isSaving = updateMutation.isPending && updateMutation.variables?.id === item.id

                    return (
                      <>
                        <tr key={item.id} className="table-row">
                          {/* Name + badges */}
                          <td className="table-cell">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-semibold text-gray-900 truncate">{item.name}</span>
                              {item.part_number && (
                                <span className="kicker">{item.part_number}</span>
                              )}
                              {item.category && (
                                <span className="badge badge-gray">{item.category.name}</span>
                              )}
                              {isSaved && (
                                <span className="badge badge-green flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Сохранено
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Qty / condition */}
                          <td className="table-cell tabular-nums text-gray-500">
                            {item.quantity} шт
                            <span className="mx-1 text-gray-300">·</span>
                            {item.condition === 'new' ? 'Новая' : item.condition === 'used' ? 'Б/У' : 'Повреждена'}
                          </td>

                          {/* Price input */}
                          <td className="table-cell">
                            <div className="flex items-center border border-amber-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                              <Tag className="w-3.5 h-3.5 text-amber-500 ml-2 flex-shrink-0" />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.selling_price}
                                onChange={(e) => setField(item.id, 'selling_price', e.target.value)}
                                placeholder="Цена"
                                className="flex-1 min-w-0 pl-1.5 pr-1 py-1.5 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() => setField(item.id, 'price_currency', row.price_currency === 'USD' ? 'UAH' : 'USD')}
                                className="px-2 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border-l border-amber-300 dark:bg-amber-800/40 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-800/60"
                              >
                                {row.price_currency === 'USD' ? '$' : '₴'}
                              </button>
                            </div>
                          </td>

                          {/* Expand toggle */}
                          <td className="table-cell">
                            <button
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              className="btn-icon-sm"
                              title="Доп. поля"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* Save */}
                          <td className="table-cell">
                            <button
                              type="button"
                              onClick={() => handleSave(item)}
                              disabled={isSaving}
                              className="cab-btn cab-btn-primary cab-btn-sm flex items-center gap-1.5"
                            >
                              <Save className="w-3.5 h-3.5" />
                              {isSaving ? 'Сохр...' : 'Сохранить'}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded extra fields row */}
                        {isExpanded && (
                          <tr key={`${item.id}-expanded`} className="bg-gray-50 dark:bg-slate-900/50">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                  <label className="form-label text-xs">Оригинальный номер</label>
                                  <input
                                    type="text"
                                    value={row.part_number}
                                    onChange={(e) => setField(item.id, 'part_number', e.target.value)}
                                    placeholder="Не указан"
                                    className="form-input py-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="form-label text-xs">Категория</label>
                                  <select
                                    value={row.category_id}
                                    onChange={(e) => setField(item.id, 'category_id', e.target.value)}
                                    className="form-select py-2 text-sm"
                                  >
                                    <option value="">Без категории</option>
                                    {categories.map((cat: any) => (
                                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                  </select>
                                </div>
                                {storageLocations.length > 0 && (
                                  <div>
                                    <label className="form-label text-xs">Место хранения</label>
                                    <select
                                      value={row.storage_location_id}
                                      onChange={(e) => setField(item.id, 'storage_location_id', e.target.value)}
                                      className="form-select py-2 text-sm"
                                    >
                                      <option value="">Не указано</option>
                                      {buildLocationOptions(storageLocations as StorageLocation[]).map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <div className={storageLocations.length > 0 ? '' : 'col-span-2'}>
                                  <label className="form-label text-xs">Описание</label>
                                  <textarea
                                    value={row.description}
                                    onChange={(e) => setField(item.id, 'description', e.target.value)}
                                    placeholder="Не указано"
                                    rows={2}
                                    className="form-input py-2 text-sm resize-none"
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (hidden on sm+) ── */}
            <div className="sm:hidden space-y-2">
              {noPriceItems.map(item => {
                const row = editState[item.id]
                if (!row) return null
                const isExpanded = expanded.has(item.id)
                const isSaved = saved.has(item.id)
                const isSaving = updateMutation.isPending && updateMutation.variables?.id === item.id

                return (
                  <div
                    key={item.id}
                    className={`cab-card transition-all ${isSaved ? 'border-green-300 dark:border-green-700' : ''}`}
                  >
                    {/* Card header */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {item.name}
                          </span>
                          {isSaved && (
                            <span className="badge badge-green flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Сохранено
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {item.quantity} шт
                          {item.part_number && (
                            <><span className="mx-1">·</span><span className="kicker">{item.part_number}</span></>
                          )}
                          {item.category && (
                            <><span className="mx-1">·</span>{item.category.name}</>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                          {item.condition === 'new' ? 'Новая' : item.condition === 'used' ? 'Б/У' : 'Повреждена'}
                        </p>
                      </div>
                    </div>

                    {/* Price row */}
                    <div className="flex items-center gap-2 px-4 pb-3">
                      <div className="flex-1 flex items-center border border-amber-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                        <Tag className="w-3.5 h-3.5 text-amber-500 ml-2 flex-shrink-0" />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.selling_price}
                          onChange={(e) => setField(item.id, 'selling_price', e.target.value)}
                          placeholder="Цена"
                          className="flex-1 min-w-0 pl-1.5 pr-1 py-2 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => setField(item.id, 'price_currency', row.price_currency === 'USD' ? 'UAH' : 'USD')}
                          className="px-2 py-2 text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border-l border-amber-300 dark:bg-amber-800/40 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-800/60"
                        >
                          {row.price_currency === 'USD' ? '$' : '₴'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="btn-icon-sm"
                        title="Доп. поля"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSave(item)}
                        disabled={isSaving}
                        className="cab-btn cab-btn-primary cab-btn-sm flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? 'Сохр...' : 'Сохр.'}
                      </button>
                    </div>

                    {/* Expanded extra fields */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-slate-700/60 px-4 py-3 grid grid-cols-1 gap-3 bg-gray-50 dark:bg-slate-900/50 rounded-b-xl">
                        <div>
                          <label className="form-label text-xs">Оригинальный номер</label>
                          <input
                            type="text"
                            value={row.part_number}
                            onChange={(e) => setField(item.id, 'part_number', e.target.value)}
                            placeholder="Не указан"
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="form-label text-xs">Категория</label>
                          <select
                            value={row.category_id}
                            onChange={(e) => setField(item.id, 'category_id', e.target.value)}
                            className="form-select"
                          >
                            <option value="">Без категории</option>
                            {categories.map((cat: any) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        {storageLocations.length > 0 && (
                          <div>
                            <label className="form-label text-xs">Место хранения</label>
                            <select
                              value={row.storage_location_id}
                              onChange={(e) => setField(item.id, 'storage_location_id', e.target.value)}
                              className="form-select"
                            >
                              <option value="">Не указано</option>
                              {buildLocationOptions(storageLocations as StorageLocation[]).map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="form-label text-xs">Описание</label>
                          <textarea
                            value={row.description}
                            onChange={(e) => setField(item.id, 'description', e.target.value)}
                            placeholder="Не указано"
                            rows={2}
                            className="form-input resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
