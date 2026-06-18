import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, ChevronRight, ChevronDown,
  Pencil, Trash2, Warehouse, Check, X,
  FolderOpen, Folder, MapPin, QrCode,
} from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import QrLabelModal from '@/components/parts/QrLabelModal'
import { useUserProfile } from '@/hooks/useUserProfile'
import { supabase } from '@/lib/supabase'
import {
  getStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
} from '@/services/partsService'
import type { StorageLocation } from '@/types/parts'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface TreeNode extends StorageLocation {
  children: TreeNode[]
  depth: number
}

/* Отступ-индент на уровень вложенности (px) */
const INDENT = 22
/* Максимум уровней вложенности склада */
const MAX_DEPTH = 4
/* Метка уровня по глубине */
const LEVEL_LABELS = ['Бокс', 'Стеллаж', 'Полка', 'Ячейка']

function buildTree(nodes: StorageLocation[], parentId: string | null = null, depth = 0): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({
      ...n,
      children: buildTree(nodes, n.id, depth + 1),
      depth,
    }))
}

function flattenTree(nodes: TreeNode[], expanded: Set<string>): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (expanded.has(node.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expanded))
    }
  }
  return result
}

export default function PartsWarehouse() {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { confirm: showConfirm, dialogProps } = useConfirm()

  // QR-этикетка: { id, name, path }
  const [qrNode, setQrNode] = useState<{ id: string; name: string; path: string } | null>(null)

  // undefined = not adding; null = adding at root; string = adding as child of that id
  const [addingParentId, setAddingParentId] = useState<string | null | undefined>(undefined)
  const [addingName, setAddingName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
        if (row.storage_location_id)
          map[row.storage_location_id] = (map[row.storage_location_id] || 0) + 1
      })
      return map
    },
    enabled: !!partsCompanyId,
  })

  const tree = useMemo(() => buildTree(locations as StorageLocation[]), [locations])
  const flatList = useMemo(() => flattenTree(tree, expanded), [tree, expanded])

  /* Полный путь узла (Бокс 1 / Стеллаж 2 / Полка 3) */
  const getNodePath = (nodeId: string): string => {
    const byId = new Map((locations as StorageLocation[]).map(l => [l.id, l]))
    const parts: string[] = []
    let cur: StorageLocation | undefined = byId.get(nodeId)
    let guard = 0
    while (cur && guard++ < 20) {
      parts.unshift(cur.name)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return parts.join(' / ')
  }

  const createMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      createStorageLocation({ name, parent_id: parentId, parts_company_id: partsCompanyId! }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['parts-storage-locations'] })
      toast.success('Место добавлено')
      setAddingParentId(undefined)
      setAddingName('')
      if (vars.parentId) setExpanded(prev => new Set([...prev, vars.parentId!]))
    },
    onError: () => toast.error('Ошибка при создании'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateStorageLocation(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-storage-locations'] })
      toast.success('Обновлено')
      setEditingId(null)
    },
    onError: () => toast.error('Ошибка при обновлении'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStorageLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-storage-locations'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Удалено')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addingName.trim()) return
    createMutation.mutate({ name: addingName.trim(), parentId: addingParentId ?? null })
  }

  const startAddChild = (nodeId: string) => {
    setAddingParentId(nodeId)
    setAddingName('')
    setExpanded(prev => new Set([...prev, nodeId]))
  }

  const cancelAdd = () => {
    setAddingParentId(undefined)
    setAddingName('')
  }

  const handleDelete = async (node: TreeNode) => {
    const usage = usageMap[node.id] || 0
    const hasChildren = node.children.length > 0
    let msg = `Удалить «${node.name}»?`
    if (hasChildren) msg = `«${node.name}» содержит вложенные места — они тоже будут удалены. Продолжить?`
    else if (usage > 0) msg = `В «${node.name}» хранится ${usage} запч. — они потеряют привязку. Продолжить?`
    const ok = await showConfirm({ message: msg, danger: true })
    if (!ok) return
    deleteMutation.mutate(node.id)
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--cab-bg)' }}>
        <p style={{ color: 'var(--cab-ink-3)' }}>Нет доступа к разборке</p>
      </div>
    )
  }

  const totalLocations = locations.length
  const usedCount = Object.keys(usageMap).length

  return (
    <div className="min-h-dvh" style={{ background: 'var(--cab-bg)' }}>
      <PartsPageHeader
        title="Места хранения"
        subtitle={totalLocations > 0 ? `${totalLocations} мест · ${usedCount} задействовано` : undefined}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => { setAddingParentId(null); setAddingName('') }}
            className="cab-btn cab-btn-primary cab-btn-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Добавить</span>
          </button>
        }
      />

      <div className="px-4 sm:px-6 py-5 space-y-4">

        {/* Add root form */}
        {addingParentId === null && (
          <div className="cab-card p-4 animate-slide-up">
            <p className="kicker mb-2">Место верхнего уровня</p>
            <p className="text-xs mb-3" style={{ color: 'var(--cab-ink-3)' }}>Бокс, зона, секция…</p>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={addingName}
                onChange={e => setAddingName(e.target.value)}
                placeholder="Например: Бокс 1"
                className="form-input flex-1"
              />
              <button
                type="submit"
                disabled={!addingName.trim() || createMutation.isPending}
                className="cab-btn cab-btn-primary px-3 min-h-[40px]"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={cancelAdd}
                className="cab-btn cab-btn-secondary px-3 min-h-[40px]"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Main content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="xl" />
          </div>
        ) : locations.length === 0 && addingParentId === undefined ? (
          /* Empty state */
          <div className="cab-card p-4">
            <div className="empty-state">
              <div className="empty-state-icon bg-slate-100 text-slate-700">
                <Warehouse className="w-7 h-7" />
              </div>
              <p className="empty-state-title">Нет мест хранения</p>
              <p className="empty-state-text">
                Создайте иерархию склада.<br />
                Например:{' '}
                <span className="font-medium" style={{ color: 'var(--cab-ink)' }}>
                  Бокс 1 → Стеллаж 2 → Полка 3 → Ячейка 4
                </span>
              </p>
              <button
                onClick={() => { setAddingParentId(null); setAddingName('') }}
                className="cab-btn cab-btn-primary mt-5"
              >
                <Plus className="w-4 h-4" />
                Создать первое место
              </button>
            </div>
          </div>
        ) : locations.length > 0 ? (
          <>
            {/* Tree card */}
            <div className="cab-card overflow-hidden">
              <div>
                {flatList.map((node) => {
                  const usage = usageMap[node.id] || 0
                  const hasChildren = node.children.length > 0
                  const isExpanded = expanded.has(node.id)
                  const isEditing = editingId === node.id
                  const isAddingChild = addingParentId === node.id
                  const levelLabel = LEVEL_LABELS[Math.min(node.depth, LEVEL_LABELS.length - 1)]
                  const indent = node.depth * INDENT

                  return (
                    <div
                      key={node.id}
                      className="border-t first:border-t-0"
                      style={{ borderColor: 'var(--cab-border)' }}
                    >
                      {/* Node row */}
                      <div
                        className="group relative flex items-center gap-2 py-2 pr-3 transition-colors"
                        style={{
                          paddingLeft: `${12 + indent}px`,
                          background: isExpanded ? 'var(--cab-surface-2)' : undefined,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--cab-surface-2)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? 'var(--cab-surface-2)' : '' }}
                      >
                        {/* Connector lines for nesting depth */}
                        {Array.from({ length: node.depth }).map((_, i) => (
                          <span
                            key={i}
                            aria-hidden
                            className="absolute top-0 bottom-0 pointer-events-none"
                            style={{
                              left: `${12 + i * INDENT + 13}px`,
                              borderLeft: '1px solid var(--cab-border)',
                            }}
                          />
                        ))}

                        {/* Expand toggle */}
                        <button
                          type="button"
                          onClick={() => hasChildren && toggleExpand(node.id)}
                          className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded transition-colors"
                          style={{ color: 'var(--cab-ink-3)', cursor: hasChildren ? 'pointer' : 'default' }}
                        >
                          {hasChildren ? (
                            isExpanded
                              ? <ChevronDown className="w-4 h-4" />
                              : <ChevronRight className="w-4 h-4" />
                          ) : (
                            <span className="w-4 h-4" />
                          )}
                        </button>

                        {/* Folder / pin icon tile */}
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-md bg-slate-100 text-slate-700">
                          {hasChildren ? (
                            isExpanded
                              ? <FolderOpen className="w-4 h-4" />
                              : <Folder className="w-4 h-4" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {/* Name or inline edit */}
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && editingName.trim())
                                updateMutation.mutate({ id: node.id, name: editingName.trim() })
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="form-input flex-1 py-1.5 text-sm"
                          />
                        ) : (
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span
                              className="font-semibold text-sm truncate"
                              style={{ color: 'var(--cab-ink)' }}
                            >
                              {node.name}
                            </span>
                            <span className="cab-chip shrink-0">{levelLabel}</span>
                            {usage > 0 && (
                              <span className="cab-chip cab-chip-signal tabular shrink-0">
                                {usage} запч.
                              </span>
                            )}
                            {hasChildren && (
                              <span
                                className="cab-chip tabular shrink-0"
                                title="Вложенных мест"
                              >
                                {node.children.length}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Action buttons — появляются по hover строки */}
                        <div
                          className={[
                            'flex items-center gap-0.5 flex-shrink-0 transition-opacity',
                            isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                          ].join(' ')}
                        >
                          {isEditing ? (
                            <>
                              <button
                                onClick={() =>
                                  editingName.trim() &&
                                  updateMutation.mutate({ id: node.id, name: editingName.trim() })
                                }
                                disabled={updateMutation.isPending}
                                className="btn-icon-sm text-green-600 hover:bg-green-50"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="btn-icon-sm"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {node.depth < MAX_DEPTH - 1 && (
                                <button
                                  onClick={() => startAddChild(node.id)}
                                  title="Добавить вложенное место"
                                  className="btn-icon-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setQrNode({ id: node.id, name: node.name, path: getNodePath(node.id) })}
                                title="QR / Этикетка"
                                className="btn-icon-sm"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setEditingId(node.id); setEditingName(node.name) }}
                                title="Переименовать"
                                className="btn-icon-sm"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(node)}
                                disabled={deleteMutation.isPending}
                                title="Удалить"
                                className="btn-icon-sm hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline add-child form */}
                      {isAddingChild && (
                        <div
                          className="relative px-3 py-3 animate-slide-up"
                          style={{
                            background: 'var(--cab-surface-2)',
                            borderTop: '1px solid var(--cab-border)',
                            paddingLeft: `${12 + (node.depth + 1) * INDENT + 12}px`,
                          }}
                        >
                          <p className="kicker mb-2" style={{ color: 'var(--cab-signal)' }}>
                            Вложенное в «{node.name}»
                          </p>
                          <form onSubmit={handleAdd} className="flex gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={addingName}
                              onChange={e => setAddingName(e.target.value)}
                              placeholder="Название…"
                              className="form-input flex-1 py-1.5 text-sm"
                            />
                            <button
                              type="submit"
                              disabled={!addingName.trim() || createMutation.isPending}
                              className="cab-btn cab-btn-primary px-3 min-h-[40px]"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelAdd}
                              className="cab-btn cab-btn-secondary px-3 min-h-[40px]"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Footer add button */}
              <div
                className="px-4 py-3"
                style={{ borderTop: '1px solid var(--cab-border)', background: 'var(--cab-surface-2)' }}
              >
                <button
                  onClick={() => { setAddingParentId(null); setAddingName('') }}
                  className="cab-btn cab-btn-secondary cab-btn-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Добавить место верхнего уровня
                </button>
              </div>
            </div>

            {/* Help hint */}
            <div className="cab-card p-4 flex gap-3">
              <div className="icon-tile-sm bg-slate-100 text-slate-700 flex-shrink-0">
                <Warehouse className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--cab-ink)' }}>Как пользоваться</p>
                <ul className="text-xs space-y-0.5 list-disc list-inside" style={{ color: 'var(--cab-ink-2)' }}>
                  <li>Наведите на место и нажмите <strong>+</strong>, чтобы добавить вложенное</li>
                  <li>При добавлении запчасти выберите место из списка</li>
                  <li>Пример: <strong>Бокс 1 → Стеллаж 3 → Полка 2 → Ячейка 5</strong></li>
                </ul>
              </div>
            </div>
          </>
        ) : null}
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
