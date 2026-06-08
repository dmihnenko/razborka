import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  Wrench, FolderOpen, Folder, Clock, Search, X,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  fetchServiceCatalog,
  createServiceCategory, updateServiceCategory, deleteServiceCategory,
  createService, updateService, deleteService,
  type ServiceCategory, type Service,
} from '@/services/servicesService'
import { fetchStoCatalogSettings } from '@/services/stoService'

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildTree(categories: ServiceCategory[]) {
  const roots = categories.filter(c => !c.parent_id)
  const childrenOf = (id: string) => categories.filter(c => c.parent_id === id)
  return { roots, childrenOf }
}

// ─── color palette ────────────────────────────────────────────────────────────

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
]

// ─── main page ────────────────────────────────────────────────────────────────

export default function Services() {
  const { data: profile } = useUserProfile()
  const stoCompanyId = profile?.sto_company_id
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // modals
  const [catModal, setCatModal] = useState<{ open: boolean; item?: ServiceCategory; parentId?: string } | null>(null)
  const [svcModal, setSvcModal] = useState<{ open: boolean; item?: Service; categoryId?: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['service-catalog', stoCompanyId],
    queryFn: () => fetchServiceCatalog(stoCompanyId!),
    enabled: !!stoCompanyId,
  })

  const categories = data?.categories || []
  const services = data?.services || []

  const { roots, childrenOf } = useMemo(() => buildTree(categories), [categories])
  const servicesOf = (catId: string) => services.filter(s => s.category_id === catId)

  // search mode: flat list filtered
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return services.filter(s =>
      s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
    )
  }, [services, search])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['service-catalog', stoCompanyId] })

  // delete category
  const delCatMutation = useMutation({
    mutationFn: deleteServiceCategory,
    onSuccess: () => { invalidate(); toast.success('Категория удалена') },
    onError: () => toast.error('Ошибка удаления'),
  })

  // delete service
  const delSvcMutation = useMutation({
    mutationFn: ({ id, svc }: { id: string; svc: Service }) =>
      deleteService(id, svc, stoCompanyId),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['services'] }); toast.success('Услуга удалена') },
    onError: () => toast.error('Ошибка удаления'),
  })

  const confirmDeleteCat = async (cat: ServiceCategory) => {
    const children = childrenOf(cat.id)
    const svcs = servicesOf(cat.id)
    const total = children.length + svcs.length
    const msg = total > 0
      ? `Удалить "${cat.name}"? Вместе с ней будут удалены ${total} вложенных элементов.`
      : `Удалить категорию "${cat.name}"?`
    if (await showConfirm({ message: msg, danger: true })) delCatMutation.mutate(cat.id)
  }

  const confirmDeleteSvc = async (svc: Service) => {
    if (await showConfirm({ message: `Удалить услугу "${svc.name}"?`, danger: true })) {
      delSvcMutation.mutate({ id: svc.id, svc })
    }
  }

  return (
    <div className="container-mobile">
      <PageHeader
        title="Каталог услуг"
        subtitle="Услуги и категории работ"
        actions={isStoOwner && (
          <button
            onClick={() => setCatModal({ open: true })}
            className="btn-primary btn-sm flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Категория</span>
            <span className="sm:hidden">+</span>
          </button>
        )}
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск услуги..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input pl-9 pr-8"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : search.trim() ? (
        /* Search results */
        <div className="card p-0 overflow-hidden divide-y divide-gray-100">
          {searchResults.length === 0 ? (
            <p className="p-6 text-center text-gray-400">Ничего не найдено</p>
          ) : searchResults.map(svc => (
            <ServiceRow key={svc.id} svc={svc} isStoOwner={!!isStoOwner}
              onEdit={() => setSvcModal({ open: true, item: svc })}
              onDelete={() => confirmDeleteSvc(svc)}
              catName={categories.find(c => c.id === svc.category_id)?.name}
            />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <EmptyState icon={Wrench} title="Каталог пуст" description="Добавьте первую категорию услуг" />
      ) : (
        /* Tree */
        <div className="space-y-2">
          {roots.map(root => {
            const subs = childrenOf(root.id)
            const rootSvcs = servicesOf(root.id)
            const isOpen = expanded.has(root.id)
            const total = subs.length + rootSvcs.length

            return (
              <div key={root.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Root category row */}
                <div className="flex items-center gap-2 px-3 sm:px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <button
                    onClick={() => toggle(root.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    }
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: root.color || '#94a3b8' }} />
                    {isOpen ? <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <Folder className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                    <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{root.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-1">({total})</span>
                  </button>
                  {isStoOwner && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setCatModal({ open: true, parentId: root.id }); setExpanded(prev => new Set([...prev, root.id])) }}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Добавить подкатегорию"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setSvcModal({ open: true, categoryId: root.id })}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Добавить услугу"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setCatModal({ open: true, item: root })}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => confirmDeleteCat(root)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div>
                    {/* Direct services on root category */}
                    {rootSvcs.map(svc => (
                      <ServiceRow key={svc.id} svc={svc} isStoOwner={!!isStoOwner} indent={1}
                        onEdit={() => setSvcModal({ open: true, item: svc })}
                        onDelete={() => confirmDeleteSvc(svc)}
                      />
                    ))}

                    {/* Subcategories */}
                    {subs.map(sub => {
                      const subSvcs = servicesOf(sub.id)
                      const subOpen = expanded.has(sub.id)
                      return (
                        <div key={sub.id}>
                          {/* Subcategory row */}
                          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gray-50/60 border-b border-gray-50">
                            <div className="w-4 flex-shrink-0" /> {/* indent */}
                            <button
                              onClick={() => toggle(sub.id)}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            >
                              {subOpen
                                ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              }
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || root.color || '#94a3b8' }} />
                              <span className="font-medium text-gray-700 text-sm truncate">{sub.name}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">({subSvcs.length})</span>
                            </button>
                            {isStoOwner && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => { setSvcModal({ open: true, categoryId: sub.id }); setExpanded(prev => new Set([...prev, sub.id])) }}
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Добавить услугу"
                                >
                                  <Wrench className="w-3 h-3" />
                                </button>
                                <button onClick={() => setCatModal({ open: true, item: sub })}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => confirmDeleteCat(sub)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {subOpen && subSvcs.map(svc => (
                            <ServiceRow key={svc.id} svc={svc} isStoOwner={!!isStoOwner} indent={2}
                              onEdit={() => setSvcModal({ open: true, item: svc })}
                              onDelete={() => confirmDeleteSvc(svc)}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Category modal */}
      {catModal?.open && (
        <CategoryModal
          item={catModal.item}
          parentId={catModal.parentId}
          stoCompanyId={stoCompanyId!}
          onClose={() => setCatModal(null)}
          onSaved={invalidate}
        />
      )}

      {/* Service modal */}
      {svcModal?.open && (
        <ServiceModal
          item={svcModal.item}
          defaultCategoryId={svcModal.categoryId}
          stoCompanyId={stoCompanyId!}
          categories={categories}
          onClose={() => setSvcModal(null)}
          onSaved={() => { invalidate(); queryClient.invalidateQueries({ queryKey: ['services'] }) }}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

// ─── service row ──────────────────────────────────────────────────────────────

function ServiceRow({
  svc, isStoOwner, indent = 0, onEdit, onDelete, catName,
}: {
  svc: Service
  isStoOwner: boolean
  indent?: number
  onEdit: () => void
  onDelete: () => void
  catName?: string
}) {
  const pad = indent === 0 ? 'pl-3' : indent === 1 ? 'pl-7' : 'pl-11'
  return (
    <div className={`flex items-center gap-2 ${pad} pr-3 sm:pr-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50`}>
      <Wrench className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-800">{svc.name}</span>
        {catName && <span className="ml-2 text-xs text-gray-400">{catName}</span>}
        {svc.description && <p className="text-xs text-gray-400 truncate">{svc.description}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {svc.norm_hours != null && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />{svc.norm_hours} н·ч
          </span>
        )}
        <span className="text-sm font-semibold text-primary">{Number(svc.price).toLocaleString()} ₴</span>
        {isStoOwner && (
          <>
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── category modal ───────────────────────────────────────────────────────────

function CategoryModal({ item, parentId, stoCompanyId, onClose, onSaved }: {
  item?: ServiceCategory
  parentId?: string
  stoCompanyId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name || '')
  const [color, setColor] = useState(item?.color || COLORS[0])

  const mutation = useMutation({
    mutationFn: async () => {
      if (item) {
        await updateServiceCategory(item.id, { name, color, sort_order: item.sort_order ?? 0 })
      } else {
        await createServiceCategory({ name, color, sto_company_id: stoCompanyId, parent_id: parentId || null } as any)
      }
    },
    onSuccess: () => { onSaved(); toast.success(item ? 'Категория обновлена' : 'Категория создана'); onClose() },
    onError: () => toast.error('Ошибка при сохранении'),
  })

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title={item ? 'Редактировать' : parentId ? 'Новая подкатегория' : 'Новая категория'}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Отмена
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="form-label">Название *</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) mutation.mutate() }}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Цвет</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── service modal ────────────────────────────────────────────────────────────

function ServiceModal({ item, defaultCategoryId, stoCompanyId, categories, onClose, onSaved }: {
  item?: Service
  defaultCategoryId?: string
  stoCompanyId: string
  categories: ServiceCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price != null ? String(item.price) : '',
    norm_hours: item?.norm_hours != null ? String(item.norm_hours) : '',
    category_id: item?.category_id || defaultCategoryId || '',
  })
  const [catSearch, setCatSearch] = useState('')
  const [showCatDrop, setShowCatDrop] = useState(false)

  // Режим каталога: 'price' (ручная цена) | 'norm_hours' (нормо-часы × ставку)
  const { data: catalog = { mode: 'price' as const, rate: 0 } } = useQuery({
    queryKey: ['sto-catalog-settings', stoCompanyId],
    queryFn: () => fetchStoCatalogSettings(stoCompanyId),
    staleTime: 60_000,
  })
  const isNorm = catalog.mode === 'norm_hours'
  const laborRate = catalog.rate
  const normHoursNum = Number(form.norm_hours) || 0
  // В режиме нормо-часов цена производная (нормо-часы × ставка); иначе — ручной ввод
  const computedPrice = isNorm ? Math.round(normHoursNum * laborRate * 100) / 100 : Number(form.price) || 0

  const filteredCats = categories.filter(c =>
    !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase())
  )
  const selectedCat = categories.find(c => c.id === form.category_id)

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: computedPrice,
        norm_hours: isNorm && form.norm_hours ? normHoursNum : null,
        duration_minutes: isNorm && form.norm_hours ? Math.round(normHoursNum * 60) : null,
        category_id: form.category_id || null,
      }
      if (item) {
        await updateService(item.id, payload)
      } else {
        await createService({ ...payload, sto_company_id: stoCompanyId })
      }
    },
    onSuccess: () => { onSaved(); toast.success(item ? 'Услуга обновлена' : 'Услуга создана'); onClose() },
    onError: () => toast.error('Ошибка при сохранении'),
  })

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title={item ? 'Редактировать услугу' : 'Новая услуга'}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Отмена</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.name.trim() || (isNorm ? !form.norm_hours : !form.price) || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700">Название *</label>
            <input autoFocus type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Category */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-700">Категория / подкатегория</label>
            <input
              type="text"
              placeholder="Выбрать..."
              value={selectedCat ? selectedCat.name : catSearch}
              onChange={e => { setCatSearch(e.target.value); if (!e.target.value) setForm(f => ({ ...f, category_id: '' })); setShowCatDrop(true) }}
              onFocus={() => setShowCatDrop(true)}
              className="mt-1 w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {(form.category_id || catSearch) && (
              <button type="button" onClick={() => { setForm(f => ({ ...f, category_id: '' })); setCatSearch(''); setShowCatDrop(false) }}
                className="absolute right-2 top-8 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
            {showCatDrop && filteredCats.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                {filteredCats.map(cat => (
                  <button key={cat.id} type="button"
                    onClick={() => { setForm(f => ({ ...f, category_id: cat.id })); setCatSearch(''); setShowCatDrop(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.parent_id && <span className="text-gray-300 text-xs">└</span>}
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700">Описание</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Цена / нормо-часы — зависит от режима каталога */}
          {isNorm ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Нормо-часы *</label>
                  <input type="number" min="0" step="0.5" inputMode="decimal" value={form.norm_hours}
                    onChange={e => setForm(f => ({ ...f, norm_hours: e.target.value }))}
                    placeholder="напр. 1.5"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Цена (₴)</label>
                  <div className="mt-1 w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-900 font-semibold tabular-nums">
                    {computedPrice.toLocaleString()} ₴
                  </div>
                </div>
              </div>
              {laborRate > 0 ? (
                <p className="text-xs text-gray-400">= {normHoursNum || 0} н·ч × {laborRate.toLocaleString()} ₴/н·ч</p>
              ) : (
                <p className="text-xs text-amber-600">Ставка нормо-часа не задана. Задайте её в «Настройки СТО», иначе цена будет 0.</p>
              )}
            </>
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-700">Цена (₴) *</label>
              <input type="number" min="0" step="0.01" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          )}
        </div>
    </Modal>
  )
}
