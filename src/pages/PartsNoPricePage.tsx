import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { Save, Tag, CheckCircle2, ChevronDown, ChevronUp, Car, Copy } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
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
  const { t } = useTranslation('cabinet')
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

  // «Требует заполнения» = нет цены ИЛИ нет оригинального номера (проданные не считаем)
  const noPriceItems: PartsInventoryItem[] = inventory.filter(
    (i: PartsInventoryItem) => i.status !== 'sold' && (!i.selling_price || !i.part_number?.trim())
  )

  // Initialize edit state for each item that needs filling
  useEffect(() => {
    setEditState(prev => {
      const next = { ...prev }
      noPriceItems.forEach(item => {
        if (!next[item.id]) {
          next[item.id] = {
            selling_price: item.selling_price ? String(item.selling_price) : '',
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
      toast.success(t('noPricePage.toastSaved'))
    },
    onError: () => toast.error(t('noPricePage.toastError')),
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

  const conditionLabel = (c: string) =>
    c === 'new' ? t('noPricePage.condNew') : c === 'used' ? t('noPricePage.condUsed') : t('noPricePage.condDamaged')

  const vehicleLabel = (item: PartsInventoryItem) =>
    item.vehicle ? `${item.vehicle.make} ${item.vehicle.model}${item.vehicle.year ? ' ' + item.vehicle.year : ''}` : null

  const copyNumber = async (num: string) => {
    try {
      await navigator.clipboard.writeText(num)
      toast.success(t('noPricePage.numberCopied'))
    } catch {
      toast.error(t('noPricePage.copyError'))
    }
  }

  /** Строка под названием: с какого авто запчасть + состояние. */
  const MetaLine = ({ item, withNumber = false }: { item: PartsInventoryItem; withNumber?: boolean }) => (
    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
      {vehicleLabel(item) ? (
        <span className="inline-flex items-center gap-1 text-gray-600">
          <Car className="w-3 h-3 text-gray-400" strokeWidth={1.5} /> {vehicleLabel(item)}
        </span>
      ) : (
        <span className="text-gray-400">{t('noPricePage.noVehicle')}</span>
      )}
      <span className="text-gray-300">·</span>
      <span>{conditionLabel(item.condition)}</span>
      {withNumber && item.part_number?.trim() && (
        <>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={() => copyNumber(item.part_number!.trim())}
            className="inline-flex items-center gap-1 font-mono text-gray-500 hover:text-primary transition-colors"
            title={t('noPricePage.clickToCopy')}
          >
            <Copy className="w-3 h-3" /> {item.part_number}
          </button>
        </>
      )}
    </p>
  )

  if (!partsCompanyId) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="empty-state">
          <p className="empty-state-title">{t('noPricePage.noAccess')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title={i18n.t('cabinet:pages.noPrice')}
        subtitle={!isLoading ? i18n.t('cabinet:pages.noPriceSub', { n: noPriceItems.length }) : undefined}
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
              <p className="empty-state-title">{t('noPricePage.allFilled')}</p>
              <p className="empty-state-text">{t('noPricePage.allFilledText')}</p>
              <button
                onClick={() => navigate('/parts/inventory')}
                className="cab-btn cab-btn-primary mt-6"
              >
                {t('noPricePage.toInventory')}
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
                    <th className="table-header-cell">{t('noPricePage.colName')}</th>
                    <th className="table-header-cell w-44">{t('noPricePage.colPrice')}</th>
                    <th className="table-header-cell w-52">{t('noPricePage.colNumber')}</th>
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
                    const needsPrice = !item.selling_price
                    const needsNumber = !item.part_number?.trim()

                    return (
                      <>
                        <tr key={item.id} className="table-row">
                          {/* Name + badges */}
                          <td className="table-cell">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-semibold text-gray-900 truncate">{item.name}</span>
                              {item.category && (
                                <span className="badge badge-gray">{item.category.name}</span>
                              )}
                              {!item.selling_price && <span className="badge badge-yellow">{t('noPricePage.noPriceBadge')}</span>}
                              {!item.part_number?.trim() && <span className="badge badge-yellow">{t('noPricePage.noNumberBadge')}</span>}
                              {isSaved && (
                                <span className="badge badge-green flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> {t('noPricePage.savedBadge')}
                                </span>
                              )}
                            </div>
                            <MetaLine item={item} />
                          </td>

                          {/* Price — input только если не заполнена */}
                          <td className="table-cell">
                            {needsPrice ? (
                              <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 border-amber-300 focus-within:ring-amber-400 bg-amber-50">
                                <Tag className="w-3.5 h-3.5 ml-2 flex-shrink-0 text-amber-500" />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.selling_price}
                                  onChange={(e) => setField(item.id, 'selling_price', e.target.value)}
                                  placeholder={t('noPricePage.pricePlaceholder')}
                                  className="flex-1 min-w-0 pl-1.5 pr-1 py-1.5 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent tabular-nums"
                                />
                                <button
                                  type="button"
                                  onClick={() => setField(item.id, 'price_currency', row.price_currency === 'USD' ? 'UAH' : 'USD')}
                                  className="px-2 py-1.5 text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border-l border-gray-200"
                                >
                                  {row.price_currency === 'USD' ? '$' : 'грн'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold text-gray-700 tabular-nums">
                                {Number(item.selling_price).toLocaleString('ru-RU')} {item.price_currency === 'UAH' ? 'грн' : '$'}
                              </span>
                            )}
                          </td>

                          {/* Ориг. номер — input только если не заполнен */}
                          <td className="table-cell">
                            {needsNumber ? (
                              <input
                                type="text"
                                value={row.part_number}
                                onChange={(e) => setField(item.id, 'part_number', e.target.value)}
                                placeholder={t('noPricePage.numberPlaceholder')}
                                className="w-full px-2.5 py-1.5 text-sm font-mono rounded-lg border focus:outline-none focus:ring-2 border-amber-300 focus:ring-amber-400 bg-amber-50"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => copyNumber(item.part_number!.trim())}
                                className="inline-flex items-center gap-1.5 text-sm font-mono text-gray-700 hover:text-primary transition-colors"
                                title={t('noPricePage.clickToCopy')}
                              >
                                {item.part_number}
                                <Copy className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            )}
                          </td>

                          {/* Expand toggle */}
                          <td className="table-cell">
                            <button
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              className="btn-icon-sm"
                              title={t('noPricePage.extraFields')}
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
                              {isSaving ? t('noPricePage.savingShort') : t('noPricePage.save')}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded extra fields row */}
                        {isExpanded && (
                          <tr key={`${item.id}-expanded`} className="bg-gray-50">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                  <label className="form-label text-xs">{t('noPricePage.category')}</label>
                                  <select
                                    value={row.category_id}
                                    onChange={(e) => setField(item.id, 'category_id', e.target.value)}
                                    className="form-select py-2 text-sm"
                                  >
                                    <option value="">{t('noPricePage.noCategory')}</option>
                                    {categories.map((cat: any) => (
                                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                  </select>
                                </div>
                                {storageLocations.length > 0 && (
                                  <div>
                                    <label className="form-label text-xs">{t('noPricePage.storageLocation')}</label>
                                    <select
                                      value={row.storage_location_id}
                                      onChange={(e) => setField(item.id, 'storage_location_id', e.target.value)}
                                      className="form-select py-2 text-sm"
                                    >
                                      <option value="">{t('noPricePage.notSpecified')}</option>
                                      {buildLocationOptions(storageLocations as StorageLocation[]).map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <div className={storageLocations.length > 0 ? '' : 'col-span-2'}>
                                  <label className="form-label text-xs">{t('noPricePage.description')}</label>
                                  <textarea
                                    value={row.description}
                                    onChange={(e) => setField(item.id, 'description', e.target.value)}
                                    placeholder={t('noPricePage.notSpecified')}
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
                const needsPrice = !item.selling_price
                const needsNumber = !item.part_number?.trim()

                return (
                  <div
                    key={item.id}
                    className={`cab-card transition-all ${isSaved ? 'border-green-300' : ''}`}
                  >
                    {/* Card header */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">
                            {item.name}
                          </span>
                          {!item.selling_price && <span className="badge badge-yellow">{t('noPricePage.noPriceBadge')}</span>}
                          {!item.part_number?.trim() && <span className="badge badge-yellow">{t('noPricePage.noNumberBadge')}</span>}
                          {isSaved && (
                            <span className="badge badge-green flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {t('noPricePage.savedBadge')}
                            </span>
                          )}
                        </div>
                        <MetaLine item={item} withNumber />
                        {item.category && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.category.name}</p>
                        )}
                      </div>
                    </div>

                    {/* Ориг. номер — только если не заполнен */}
                    {needsNumber && (
                      <div className="px-4 pb-2">
                        <input
                          type="text"
                          value={row.part_number}
                          onChange={(e) => setField(item.id, 'part_number', e.target.value)}
                          placeholder={t('noPricePage.numberPlaceholderFull')}
                          className="w-full px-3 py-2 text-sm font-mono rounded-lg border focus:outline-none focus:ring-2 border-amber-300 focus:ring-amber-400 bg-amber-50"
                        />
                      </div>
                    )}

                    {/* Price row */}
                    <div className="flex items-center gap-2 px-4 pb-3">
                      {needsPrice ? (
                        <div className="flex-1 flex items-center border rounded-lg overflow-hidden focus-within:ring-2 border-amber-300 focus-within:ring-amber-400 bg-amber-50">
                          <Tag className="w-3.5 h-3.5 ml-2 flex-shrink-0 text-amber-500" />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.selling_price}
                            onChange={(e) => setField(item.id, 'selling_price', e.target.value)}
                            placeholder={t('noPricePage.pricePlaceholder')}
                            className="flex-1 min-w-0 pl-1.5 pr-1 py-2 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => setField(item.id, 'price_currency', row.price_currency === 'USD' ? 'UAH' : 'USD')}
                            className="px-2 py-2 text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border-l border-gray-200"
                          >
                            {row.price_currency === 'USD' ? '$' : 'грн'}
                          </button>
                        </div>
                      ) : (
                        <span className="flex-1 text-sm font-semibold text-gray-700 tabular-nums">
                          {Number(item.selling_price).toLocaleString('ru-RU')} {item.price_currency === 'UAH' ? 'грн' : '$'}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="btn-icon-sm"
                        title={t('noPricePage.extraFields')}
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
                        {isSaving ? t('noPricePage.savingShort') : t('noPricePage.saveShort')}
                      </button>
                    </div>

                    {/* Expanded extra fields */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-1 gap-3 bg-gray-50 rounded-b-xl">
                        <div>
                          <label className="form-label text-xs">{t('noPricePage.category')}</label>
                          <select
                            value={row.category_id}
                            onChange={(e) => setField(item.id, 'category_id', e.target.value)}
                            className="form-select"
                          >
                            <option value="">{t('noPricePage.noCategory')}</option>
                            {categories.map((cat: any) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        {storageLocations.length > 0 && (
                          <div>
                            <label className="form-label text-xs">{t('noPricePage.storageLocation')}</label>
                            <select
                              value={row.storage_location_id}
                              onChange={(e) => setField(item.id, 'storage_location_id', e.target.value)}
                              className="form-select"
                            >
                              <option value="">{t('noPricePage.notSpecified')}</option>
                              {buildLocationOptions(storageLocations as StorageLocation[]).map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="form-label text-xs">{t('noPricePage.description')}</label>
                          <textarea
                            value={row.description}
                            onChange={(e) => setField(item.id, 'description', e.target.value)}
                            placeholder={t('noPricePage.notSpecified')}
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
