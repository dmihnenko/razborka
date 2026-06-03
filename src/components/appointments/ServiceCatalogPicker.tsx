import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ChevronRight, ChevronDown, Wrench, Clock, Check } from 'lucide-react'
import { fetchServiceCatalog, type ServiceCategory, type Service } from '@/services/servicesService'

interface Props {
  stoCompanyId: string
  selectedNames?: string[] // for visual "already added" hint
  onSelect: (service: Service) => void
  onClose: () => void
}

function buildTree(categories: ServiceCategory[]) {
  const roots = categories.filter(c => !c.parent_id)
  const childrenOf = (id: string) => categories.filter(c => c.parent_id === id)
  return { roots, childrenOf }
}

export default function ServiceCatalogPicker({ stoCompanyId, selectedNames = [], onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['service-catalog', stoCompanyId],
    queryFn: () => fetchServiceCatalog(stoCompanyId),
    staleTime: 60_000,
  })

  const categories = data?.categories || []
  const services = data?.services || []

  const { roots, childrenOf } = useMemo(() => buildTree(categories), [categories])
  const servicesOf = (catId: string) => services.filter(s => s.category_id === catId)

  // auto-expand root categories on first load
  useEffect(() => {
    if (roots.length > 0 && expanded.size === 0) {
      setExpanded(new Set(roots.map(r => r.id)))
    }
  }, [roots.length])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return services.filter(s =>
      s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
    )
  }, [services, search])

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const isAdded = (svc: Service) => selectedNames.includes(svc.name)

  const handleSelect = (svc: Service) => {
    onSelect(svc)
    // keep open for multi-select
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Поиск услуги..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-1 p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-72 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : search.trim() ? (
          /* Search results */
          searchResults.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Ничего не найдено</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {searchResults.map(svc => (
                <ServicePickerRow key={svc.id} svc={svc} added={isAdded(svc)}
                  catName={categories.find(c => c.id === svc.category_id)?.name}
                  onSelect={() => handleSelect(svc)}
                />
              ))}
            </div>
          )
        ) : services.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Каталог пуст</p>
        ) : (
          /* Tree browse */
          <div>
            {roots.map(root => {
              const subs = childrenOf(root.id)
              const rootSvcs = servicesOf(root.id)
              const isOpen = expanded.has(root.id)

              return (
                <div key={root.id}>
                  {/* Root category */}
                  <button
                    type="button"
                    onClick={() => toggle(root.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left border-b border-gray-100"
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: root.color || '#94a3b8' }} />
                    <span className="font-medium text-sm text-gray-800 flex-1">{root.name}</span>
                    <span className="text-xs text-gray-400">{subs.length + rootSvcs.length}</span>
                  </button>

                  {isOpen && (
                    <>
                      {rootSvcs.map(svc => (
                        <ServicePickerRow key={svc.id} svc={svc} added={isAdded(svc)} indent={1}
                          onSelect={() => handleSelect(svc)} />
                      ))}
                      {subs.map(sub => {
                        const subSvcs = servicesOf(sub.id)
                        const subOpen = expanded.has(sub.id)
                        return (
                          <div key={sub.id}>
                            <button
                              type="button"
                              onClick={() => toggle(sub.id)}
                              className="w-full flex items-center gap-2 pl-6 pr-3 py-2 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
                            >
                              {subOpen ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || root.color || '#94a3b8' }} />
                              <span className="text-sm text-gray-700 flex-1">{sub.name}</span>
                              <span className="text-xs text-gray-400">{subSvcs.length}</span>
                            </button>
                            {subOpen && subSvcs.map(svc => (
                              <ServicePickerRow key={svc.id} svc={svc} added={isAdded(svc)} indent={2}
                                onSelect={() => handleSelect(svc)} />
                            ))}
                          </div>
                        )
                      })}
                    </>
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

function ServicePickerRow({ svc, added, indent = 0, catName, onSelect }: {
  svc: Service
  added: boolean
  indent?: number
  catName?: string
  onSelect: () => void
}) {
  const pl = indent === 0 ? 'pl-3' : indent === 1 ? 'pl-7' : 'pl-11'
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 ${pl} pr-3 py-2.5 text-left transition-colors border-b border-gray-50 last:border-0 ${
        added ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-blue-50'
      }`}
    >
      <Wrench className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-tight truncate">{svc.name}</p>
        {catName && <p className="text-xs text-gray-400 truncate">{catName}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {svc.duration_minutes && (
          <span className="hidden sm:flex items-center gap-0.5 text-xs text-gray-400">
            <Clock className="w-3 h-3" />{svc.duration_minutes}м
          </span>
        )}
        <span className="text-sm font-semibold text-primary">{Number(svc.price).toLocaleString()} ₴</span>
        {added && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
      </div>
    </button>
  )
}
