import { useMemo } from 'react'
import { X } from 'lucide-react'
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
 * Следующий уровень появляется после выбора родителя; можно остановиться на
 * любом уровне (место = последний выбранный узел). Чипы — общие .chip/.chip-active.
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

  const hasSelection = !!(value && byId.get(value))

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
                  // Повторный тап по выбранному листу — снять выбор; по ветке — оставить.
                  onClick={() => onChange(active && !hasKids ? undefined : n.id)}
                  className={`chip ${active ? 'chip-active' : ''}`}
                >
                  {n.name}
                  {hasKids && (
                    <span className={`text-[11px] leading-none ${active ? 'text-white/70' : 'text-gray-400'}`}>›</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {hasSelection && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <span className="truncate">{chain.map((id) => byId.get(id)?.name).filter(Boolean).join(' → ')}</span>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex items-center gap-0.5 text-gray-400 hover:text-red-500 flex-shrink-0"
          >
            <X className="w-3 h-3" /> {t('inventoryPage.clearLocation', { defaultValue: 'очистить' })}
          </button>
        </div>
      )}
    </div>
  )
}

export default StorageLocationCascade
