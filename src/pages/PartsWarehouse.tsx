import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Warehouse, Check, X, QrCode, ChevronLeft, ChevronRight, FolderTree, GripVertical } from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import QrLabelModal from '@/components/parts/QrLabelModal'
import { useUserProfile } from '@/hooks/useUserProfile'
import { supabase } from '@/lib/supabase'
import {
  getStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
} from '@/services/partsService'
import { formatPrice } from '@/utils/currency'
import type { StorageLocation } from '@/types/parts'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface FlatNode extends StorageLocation { depth: number; childCount: number }

// Позиция склада в списке выбранного места (форма supabase-select ниже).
interface WarehouseItemRow {
  id: string
  name: string
  article: string | null
  part_number: string | null
  selling_price: number | null
  price_currency: 'UAH' | 'USD' | null
  quantity: number
  status: string
  storage_location_id: string | null
}

const INDENT = 16
const MAX_DEPTH = 4

/** Плоский список мест с глубиной (DFS, сохраняет порядок). Дети свёрнутых узлов скрыты. */
function flatten(nodes: StorageLocation[], collapsed: Set<string>): FlatNode[] {
  const childrenOf = (id: string | null) =>
    nodes.filter(n => n.parent_id === id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  const out: FlatNode[] = []
  const walk = (n: StorageLocation, depth: number) => {
    const kids = childrenOf(n.id)
    out.push({ ...n, depth, childCount: kids.length })
    if (!collapsed.has(n.id)) kids.forEach(k => walk(k, depth + 1))
  }
  childrenOf(null).forEach(r => walk(r, 0))
  return out
}

export default function PartsWarehouse() {
  const { t } = useTranslation('cabinet')
  const LEVEL_LABELS = [t('warehousePage.levelBox'), t('warehousePage.levelRack'), t('warehousePage.levelShelf'), t('warehousePage.levelCell')]
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qrNode, setQrNode] = useState<{ id: string; name: string; path: string } | null>(null)
  const [addingParentId, setAddingParentId] = useState<string | null | undefined>(undefined) // undefined=нет, null=корень, id=вложенное
  const [addingName, setAddingName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [structMode, setStructMode] = useState(false) // перетаскивание структуры (только для основной категории)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const didInitCollapse = useRef(false)

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['parts-storage-locations', partsCompanyId],
    queryFn: () => getStorageLocations(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const { data: usageMap = {} } = useQuery<Record<string, number>>({
    queryKey: ['parts-storage-usage', partsCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_inventory')
        .select('storage_location_id')
        .eq('parts_company_id', partsCompanyId!)
        .not('storage_location_id', 'is', null)
      const map: Record<string, number> = {}
      ;(data || []).forEach((row: { storage_location_id: string | null }) => {
        if (row.storage_location_id) map[row.storage_location_id] = (map[row.storage_location_id] || 0) + 1
      })
      return map
    },
    enabled: !!partsCompanyId,
  })

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, StorageLocation[]>()
    for (const l of locations as StorageLocation[]) {
      const k = l.parent_id
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(l)
    }
    return m
  }, [locations])

  const locNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of locations as StorageLocation[]) m.set(l.id, l.name)
    return m
  }, [locations])

  // Выбранное место + все вложенные (товары показываем рекурсивно из подкатегорий)
  const subtreeIds = useMemo(() => {
    if (!selectedId) return [] as string[]
    const ids = [selectedId]
    const stack = [selectedId]
    while (stack.length) {
      const cur = stack.pop()!
      for (const k of childrenMap.get(cur) || []) { ids.push(k.id); stack.push(k.id) }
    }
    return ids
  }, [selectedId, childrenMap])

  // Позиции выбранного места и всех вложенных подкатегорий
  const { data: items = [], isLoading: itemsLoading } = useQuery<WarehouseItemRow[]>({
    queryKey: ['parts-location-items', subtreeIds],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_inventory')
        .select('id, name, article, part_number, selling_price, price_currency, quantity, status, storage_location_id')
        .eq('parts_company_id', partsCompanyId!)
        .in('storage_location_id', subtreeIds)
        .order('name')
      return (data || []) as WarehouseItemRow[]
    },
    enabled: !!partsCompanyId && subtreeIds.length > 0,
  })

  const flat = useMemo(() => flatten(locations as StorageLocation[], collapsed), [locations, collapsed])
  const allFlat = useMemo(() => flatten(locations as StorageLocation[], new Set<string>()), [locations])
  const selected = allFlat.find(n => n.id === selectedId) || null
  const depthOf = (id: string) => allFlat.find(n => n.id === id)?.depth ?? 0

  // Высота поддерева (0 — лист)
  const subtreeHeight = (id: string): number => {
    const kids = childrenMap.get(id) || []
    return kids.length ? 1 + Math.max(...kids.map(k => subtreeHeight(k.id))) : 0
  }
  // target внутри поддерева src? (защита от цикла)
  const isDescendant = (srcId: string, targetId: string): boolean => {
    const stack = [...(childrenMap.get(srcId) || [])]
    while (stack.length) {
      const n = stack.pop()!
      if (n.id === targetId) return true
      stack.push(...(childrenMap.get(n.id) || []))
    }
    return false
  }
  // Можно ли переместить src внутрь target как ребёнка
  const canDrop = (srcId: string, targetId: string): boolean => {
    if (srcId === targetId) return false
    const src = (locations as StorageLocation[]).find(l => l.id === srcId)
    if (!src) return false
    if (src.parent_id === targetId) return false // уже там
    if (isDescendant(srcId, targetId)) return false // цикл
    // глубина после перемещения не должна превышать лимит
    if (depthOf(targetId) + 1 + subtreeHeight(srcId) > MAX_DEPTH - 1) return false
    return true
  }

  // Дефолт: подкатегории свёрнуты (свернуть все узлы с детьми один раз при загрузке)
  useEffect(() => {
    if (!didInitCollapse.current && locations.length) {
      const parents = new Set<string>()
      for (const l of locations as StorageLocation[]) if (l.parent_id) parents.add(l.parent_id)
      setCollapsed(parents)
      didInitCollapse.current = true
    }
  }, [locations])

  // Десктоп: авто-выбор первого места, если выбора нет
  useEffect(() => {
    if (!selectedId && flat.length && window.matchMedia('(min-width:640px)').matches) {
      setSelectedId(flat[0].id)
    }
  }, [flat, selectedId])

  // Структурный режим доступен только для основной (корневой) категории
  const structActive = structMode && selected?.depth === 0

  const getNodePath = (nodeId: string): string => {
    const byId = new Map((locations as StorageLocation[]).map(l => [l.id, l]))
    const parts: string[] = []
    let cur: StorageLocation | undefined = byId.get(nodeId)
    let guard = 0
    while (cur && guard++ < 20) { parts.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined }
    return parts.join(' / ')
  }

  const createMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      createStorageLocation({ name, parent_id: parentId, parts_company_id: partsCompanyId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-storage-locations'] })
      toast.success(t('warehousePage.toastAdded'))
      setAddingParentId(undefined); setAddingName('')
    },
    onError: () => toast.error(t('warehousePage.toastCreateError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateStorageLocation(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-storage-locations'] })
      toast.success(t('warehousePage.toastUpdated')); setEditingId(null)
    },
    onError: () => toast.error(t('warehousePage.toastUpdateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStorageLocation(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['parts-storage-locations'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('warehousePage.toastDeleted'))
      if (selectedId === id) setSelectedId(null)
    },
    onError: () => toast.error(t('warehousePage.toastDeleteError')),
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, parentId, sortOrder }: { id: string; parentId: string; sortOrder: number }) =>
      updateStorageLocation(id, { parent_id: parentId, sort_order: sortOrder }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['parts-storage-locations'] })
      setCollapsed(prev => { const n = new Set(prev); n.delete(vars.parentId); return n }) // раскрыть цель
      toast.success(t('warehousePage.toastMoved'))
    },
    onError: () => toast.error(t('warehousePage.toastMoveError')),
  })

  const handleDrop = (srcId: string, targetId: string) => {
    if (!canDrop(srcId, targetId)) return
    const sortOrder = (childrenMap.get(targetId) || []).length
    moveMutation.mutate({ id: srcId, parentId: targetId, sortOrder })
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addingName.trim()) return
    createMutation.mutate({ name: addingName.trim(), parentId: addingParentId ?? null })
  }

  const handleDelete = async (node: FlatNode) => {
    const usage = usageMap[node.id] || 0
    let msg = t('warehousePage.confirmDelete', { name: node.name })
    if (node.childCount > 0) msg = t('warehousePage.confirmDeleteWithChildren', { name: node.name })
    else if (usage > 0) msg = t('warehousePage.confirmDeleteWithItems', { name: node.name, n: usage })
    const ok = await showConfirm({ message: msg, danger: true })
    if (ok) deleteMutation.mutate(node.id)
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--cab-bg)' }}>
        <p style={{ color: 'var(--cab-ink-3)' }}>{t('warehousePage.noAccess')}</p>
      </div>
    )
  }

  const totalLocations = locations.length
  const usedCount = Object.keys(usageMap).length

  return (
    <div className="min-h-dvh" style={{ background: 'var(--cab-bg)' }}>
      <PartsPageHeader
        title={i18n.t('cabinet:pages.warehouse')}
        subtitle={totalLocations > 0 ? t('warehousePage.subtitle', { total: totalLocations, used: usedCount }) : undefined}
        backPath="/parts/dashboard"
        actions={
          <button onClick={() => { setAddingParentId(null); setAddingName('') }} className="cab-btn cab-btn-primary cab-btn-sm flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('warehousePage.addLocation')}</span>
          </button>
        }
      />

      <div className="px-4 sm:px-6 py-5">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="xl" /></div>
        ) : locations.length === 0 && addingParentId === undefined ? (
          <div className="cab-card p-4">
            <div className="empty-state">
              <div className="empty-state-icon" style={{ background: 'var(--cab-surface-2)', color: 'var(--cab-ink-2)' }}>
                <Warehouse className="w-7 h-7" />
              </div>
              <p className="empty-state-title">{t('warehousePage.emptyTitle')}</p>
              <p className="empty-state-text">
                {t('warehousePage.emptyText')}{' '}
                <span className="font-medium" style={{ color: 'var(--cab-ink)' }}>{t('warehousePage.emptyExample')}</span>
              </p>
              <button onClick={() => { setAddingParentId(null); setAddingName('') }} className="cab-btn cab-btn-primary mt-5">
                <Plus className="w-4 h-4" /> {t('warehousePage.createFirst')}
              </button>
            </div>
          </div>
        ) : (
          <div className="cab-card overflow-hidden">
            <div className="flex flex-col sm:flex-row min-h-[60vh] sm:min-h-[440px]">

              {/* ── Левая: места хранения ── */}
              <div className={`${selectedId ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-72 sm:flex-shrink-0`}
                style={{ background: 'var(--cab-surface-2)', borderRight: '1px solid var(--cab-border)' }}>
                {/* Форма добавления корневого места */}
                {addingParentId === null && (
                  <form onSubmit={handleAdd} className="p-2.5 flex gap-2" style={{ borderBottom: '1px solid var(--cab-border)' }}>
                    <input autoFocus value={addingName} onChange={e => setAddingName(e.target.value)} placeholder={t('warehousePage.placeholderRoot')} className="form-input flex-1 py-1.5 text-sm" />
                    <button type="submit" disabled={!addingName.trim() || createMutation.isPending} className="cab-btn cab-btn-primary px-2.5 min-h-[36px]"><Check className="w-4 h-4" /></button>
                    <button type="button" onClick={() => { setAddingParentId(undefined); setAddingName('') }} className="cab-btn cab-btn-secondary px-2.5 min-h-[36px]"><X className="w-4 h-4" /></button>
                  </form>
                )}
                {structActive && (
                  <p className="px-3 py-2 text-[11px] flex items-center gap-1.5" style={{ background: 'var(--cab-signal-weak)', color: 'var(--cab-signal)', borderBottom: '1px solid var(--cab-border)' }}>
                    <GripVertical className="w-3.5 h-3.5 flex-shrink-0" /> {t('warehousePage.dragHint')}
                  </p>
                )}
                <div className="overflow-y-auto p-2 max-h-[62vh] sm:max-h-none">
                  {flat.map(node => {
                    const active = selectedId === node.id
                    const count = usageMap[node.id] || 0
                    const hasKids = node.childCount > 0
                    const isCollapsed = collapsed.has(node.id)
                    const draggable = structActive && node.depth > 0
                    const isDragging = dragId === node.id
                    const isDropTarget = dropId === node.id
                    return (
                      <div key={node.id}
                        draggable={draggable}
                        onDragStart={draggable ? (e => { setDragId(node.id); e.dataTransfer.effectAllowed = 'move' }) : undefined}
                        onDragEnd={() => { setDragId(null); setDropId(null) }}
                        onDragOver={structActive && dragId && canDrop(dragId, node.id) ? (e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropId(node.id) }) : undefined}
                        onDragLeave={() => setDropId(prev => (prev === node.id ? null : prev))}
                        onDrop={structActive && dragId ? (e => { e.preventDefault(); handleDrop(dragId, node.id); setDragId(null); setDropId(null) }) : undefined}
                        style={{
                          paddingLeft: 8 + node.depth * INDENT,
                          background: isDropTarget ? 'var(--cab-signal-weak)' : active ? 'var(--cab-surface)' : undefined,
                          opacity: isDragging ? 0.4 : 1,
                          boxShadow: isDropTarget ? 'inset 0 0 0 1.5px var(--cab-signal)' : undefined,
                        }}
                        className={`relative flex items-center rounded-lg pr-2 mb-0.5 transition-colors ${active && !isDropTarget ? 'shadow-sm' : ''} ${!active && !isDropTarget ? 'hover:bg-[var(--cab-surface)]/70' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                        {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: 'var(--cab-signal)' }} />}
                        {draggable && <GripVertical className="flex-shrink-0 w-3.5 h-3.5 mr-0.5" style={{ color: 'var(--cab-ink-3)' }} />}
                        {hasKids ? (
                          <button onClick={() => toggleCollapse(node.id)}
                            className="flex-shrink-0 p-1 rounded-md hover:bg-black/5" aria-label={isCollapsed ? t('warehousePage.expand') : t('warehousePage.collapse')}>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} style={{ color: 'var(--cab-ink-3)' }} />
                          </button>
                        ) : (
                          <span className="flex-shrink-0 w-[26px]" />
                        )}
                        <button onClick={() => setSelectedId(node.id)}
                          className={`flex-1 min-w-0 text-left flex items-center gap-2 py-2.5 text-sm ${active ? 'font-semibold' : ''}`}>
                          <span className="flex-1 truncate" style={{ color: active ? 'var(--cab-ink)' : 'var(--cab-ink-2)' }}>{node.name}</span>
                          {count > 0 && <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--cab-ink-3)' }}>{count}</span>}
                        </button>
                      </div>
                    )
                  })}
                  {flat.length === 0 && (
                    <p className="px-3 py-8 text-center text-sm" style={{ color: 'var(--cab-ink-3)' }}>{t('warehousePage.listEmpty')}</p>
                  )}
                </div>
              </div>

              {/* ── Правая: позиции выбранного места ── */}
              <div className={`${selectedId ? 'flex' : 'hidden sm:flex'} flex-col flex-1 min-w-0`} style={{ background: 'var(--cab-surface)' }}>
                {selected ? (
                  <>
                    {/* Шапка выбранного места */}
                    <div className="flex items-center gap-2 px-3 sm:px-4 h-14 flex-shrink-0" style={{ borderBottom: '1px solid var(--cab-border)' }}>
                      <button onClick={() => setSelectedId(null)} className="sm:hidden -ml-1 btn-icon" aria-label={t('warehousePage.back')}><ChevronLeft className="w-5 h-5" /></button>
                      {editingId === selected.id ? (
                        <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && editingName.trim()) updateMutation.mutate({ id: selected.id, name: editingName.trim() }); if (e.key === 'Escape') setEditingId(null) }}
                          className="form-input flex-1 py-1.5 text-sm" />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--cab-ink)' }}>{selected.name}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--cab-ink-3)' }}>
                            {LEVEL_LABELS[Math.min(selected.depth, LEVEL_LABELS.length - 1)]}
                            {selected.depth > 0 && ` · ${getNodePath(selected.id)}`}
                            {items.length > 0 && ` · ${t('warehousePage.positionsCount', { n: items.length })}`}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {editingId === selected.id ? (
                          <>
                            <button onClick={() => editingName.trim() && updateMutation.mutate({ id: selected.id, name: editingName.trim() })} className="btn-icon-sm text-green-600 hover:bg-green-50"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="btn-icon-sm"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            {selected.depth === 0 && (
                              <button onClick={() => setStructMode(s => !s)} title={t('warehousePage.dragMode')}
                                className="btn-icon-sm" style={structActive ? { color: 'var(--cab-signal)', background: 'var(--cab-signal-weak)' } : undefined}>
                                <FolderTree className="w-4 h-4" />
                              </button>
                            )}
                            {selected.depth < MAX_DEPTH - 1 && (
                              <button onClick={() => { setAddingParentId(selected.id); setAddingName('') }} title={t('warehousePage.nestedLocation')} className="btn-icon-sm"><Plus className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => setQrNode({ id: selected.id, name: selected.name, path: getNodePath(selected.id) })} title={t('warehousePage.qrLabel')} className="btn-icon-sm"><QrCode className="w-4 h-4" /></button>
                            <button onClick={() => { setEditingId(selected.id); setEditingName(selected.name) }} title={t('warehousePage.rename')} className="btn-icon-sm"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(selected)} disabled={deleteMutation.isPending} title={t('warehousePage.delete')} className="btn-icon-sm hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Форма вложенного места */}
                    {addingParentId === selected.id && (
                      <form onSubmit={handleAdd} className="flex gap-2 px-3 sm:px-4 py-2.5" style={{ background: 'var(--cab-surface-2)', borderBottom: '1px solid var(--cab-border)' }}>
                        <input autoFocus value={addingName} onChange={e => setAddingName(e.target.value)} placeholder={t('warehousePage.placeholderNested', { name: selected.name })} className="form-input flex-1 py-1.5 text-sm" />
                        <button type="submit" disabled={!addingName.trim() || createMutation.isPending} className="cab-btn cab-btn-primary px-2.5 min-h-[36px]"><Check className="w-4 h-4" /></button>
                        <button type="button" onClick={() => { setAddingParentId(undefined); setAddingName('') }} className="cab-btn cab-btn-secondary px-2.5 min-h-[36px]"><X className="w-4 h-4" /></button>
                      </form>
                    )}

                    {/* Позиции */}
                    {itemsLoading ? (
                      <div className="flex justify-center py-12"><Spinner size="md" /></div>
                    ) : items.length === 0 ? (
                      <p className="px-4 py-12 text-center text-sm" style={{ color: 'var(--cab-ink-3)' }}>{t('warehousePage.itemsEmpty')}</p>
                    ) : (
                      <div className="overflow-y-auto" style={{ borderColor: 'var(--cab-border)' }}>
                        {items.map(it => (
                          <button key={it.id} onClick={() => navigate(`/parts/inventory/${it.id}`)}
                            className="w-full text-left flex items-center gap-3 px-3 sm:px-4 py-3 transition-colors hover:bg-[var(--cab-surface-2)]"
                            style={{ borderTop: '1px solid var(--cab-border)' }}>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block" style={{ color: 'var(--cab-ink)' }}>{it.name}</span>
                              <span className="text-xs truncate flex items-center gap-1.5" style={{ color: 'var(--cab-ink-3)' }}>
                                <span className="truncate">{t('warehousePage.article')} {it.article}{it.part_number ? ` · OEM ${String(it.part_number).toUpperCase()}` : ''}</span>
                                {it.storage_location_id && it.storage_location_id !== selectedId && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--cab-surface-2)', color: 'var(--cab-ink-2)' }}>
                                    {locNameById.get(it.storage_location_id) || '—'}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {it.quantity > 1 && <span className="text-xs tabular-nums" style={{ color: 'var(--cab-ink-3)' }}>{t('warehousePage.pcs', { n: it.quantity })}</span>}
                              {it.selling_price != null && (
                                <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: 'var(--cab-ink)' }}>
                                  {formatPrice(it.selling_price, (it.price_currency as 'UAH' | 'USD') || 'USD')}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="hidden sm:flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--cab-ink-3)' }}>
                    {t('warehousePage.selectPrompt')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />

      {qrNode && (
        <QrLabelModal
          title={qrNode.name}
          subtitle={qrNode.path !== qrNode.name ? qrNode.path : undefined}
          value={`${window.location.origin}/public/parts-location/${qrNode.id}`}
          onClose={() => setQrNode(null)}
        />
      )}
    </div>
  )
}
