import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { StorageLocation } from '@/types/parts'

interface Props {
  /** Плоский список мест (иерархия через parent_id). */
  locations: StorageLocation[]
  /** Выбранное место (любой узел — лист или ветка). */
  value?: string
  /** id выбранного узла или undefined при сбросе. */
  onChange: (id: string | undefined) => void
  className?: string
}

/**
 * Каскадный выбор места хранения по уровням: Стеллаж → Полка → Ячейка.
 * Оформление — из демо: индиго-тинт активного чипа, счётчик мест у веток,
 * моно-код у ячеек, путь-крошка с галочкой. Следующий уровень появляется
 * после выбора родителя; можно остановиться на любом уровне.
 */
export function StorageLocationCascade({ locations, value, onChange, className }: Props) {
  const { t } = useTranslation('cabinet')

  const { byId, childrenOf, roots } = useMemo(() => {
    const byId = new Map<string, StorageLocation>()
    const childrenOf = new Map<string, StorageLocation[]>()
    locations.forEach((l) => byId.set(l.id, l))
    locations.forEach((l) => {
      const key = l.parent_id ?? '__root__'
      const arr = childrenOf.get(key) || []
      arr.push(l)
      childrenOf.set(key, arr)
    })
    const sortFn = (a: StorageLocation, b: StorageLocation) =>
      (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'ru')
    childrenOf.forEach((arr) => arr.sort(sortFn))
    return { byId, childrenOf, roots: childrenOf.get('__root__') || [] }
  }, [locations])

  // Кол-во выбираемых мест внутри узла (для счётчика на ветках).
  const leafCount = (id: string): number => {
    const kids = childrenOf.get(id)
    if (!kids || !kids.length) return 1
    return kids.reduce((s, k) => s + leafCount(k.id), 0)
  }

  // Цепочка выбранных узлов от корня до value (по parent_id).
  const chain = useMemo(() => {
    const out: string[] = []
    let cur = value ? byId.get(value) : undefined
    while (cur) {
      out.unshift(cur.id)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return out
  }, [value, byId])

  // Уровни для рендера: корни, затем дети выбранного на каждом уровне (пока есть).
  const levels: StorageLocation[][] = []
  let levelNodes = roots
  let depth = 0
  while (levelNodes.length) {
    levels.push(levelNodes)
    const selectedId = chain[depth]
    const kids = selectedId ? childrenOf.get(selectedId) || [] : []
    if (selectedId && kids.length) {
      levelNodes = kids
      depth++
    } else break
  }

  const selectedNode = value ? byId.get(value) : undefined
  const selectedIsLeaf = selectedNode ? !(childrenOf.get(selectedNode.id)?.length) : false

  return (
    <div className={className}>
      <div className="space-y-2">
        {levels.map((nodes, d) => (
          <div key={d} className="flex flex-wrap gap-1.5">
            {nodes.map((n) => {
              const hasKids = (childrenOf.get(n.id)?.length ?? 0) > 0
              const active = chain[d] === n.id
              return (
                <button
                  key={n.id}
                  type="button"
                  // Повторный тап по выбранной ячейке — снять выбор; по ветке — оставить.
                  onClick={() => onChange(active && !hasKids ? undefined : n.id)}
                  className={`loc-chip ${active ? 'is-active' : ''} ${hasKids ? '' : 'font-mono'}`}
                >
                  {n.name}
                  {hasKids && <span className="loc-cnt">{leafCount(n.id)}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {selectedNode && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className="loc-crumb">
            <span className="text-[var(--cab-signal)]">✓</span>
            <span>
              {chain.slice(0, -1).map((id) => byId.get(id)?.name).filter(Boolean).join(' → ')}
              {chain.length > 1 && ' → '}
              <b className={selectedIsLeaf ? 'font-mono' : ''}>{selectedNode.name}</b>
            </span>
          </span>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-xs text-[var(--cab-ink-3)] hover:text-[var(--cab-signal)] underline underline-offset-2"
          >
            {t('inventoryPage.clearLocation', { defaultValue: 'Сбросить' })}
          </button>
        </div>
      )}
    </div>
  )
}

export default StorageLocationCascade
