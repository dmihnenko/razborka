import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Tag, X, Check, List, Download, Search, CornerDownRight } from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import {
  getPartsCategories,
  createPartsCategory,
  createPartsCategoriesBulk,
  updatePartsCategory,
  deletePartsCategory,
  getPartsCategoryTemplates,
  copyTemplateCategories,
  getPartsCategoriesUsage,
} from '@/services/partsService'

import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { PartsCategory, CreatePartsCategoryInput } from '@/types/parts'

type Tab = 'my' | 'templates'
type AddMode = 'single' | 'list'

/** Стандартный стартовый набор категорий разборки. Кнопка «Базовые» добавляет
    недостающие из него (СТО может скопировать для быстрого старта или делать свои). */
const BASE_CATEGORIES = [
  'Двигатель',
  'Коробка передач',
  'Подвеска',
  'Тормозная система',
  'Электрика',
  'Кузовные детали',
  'Оптика',
  'Салон',
  'Колёса и диски',
  'Система охлаждения',
]

export default function PartsCategories() {
  const { t } = useTranslation('cabinet')
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'my')
  const [addMode, setAddMode] = useState<AddMode>('single')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [bulkText, setBulkText] = useState('')

  const [templateBrand, setTemplateBrand] = useState(searchParams.get('brand') || '')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['parts-categories-manage', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return []
      const all = await getPartsCategories(partsCompanyId)
      return all.filter(c => c.parts_company_id === partsCompanyId)
    },
    enabled: !!partsCompanyId,
  })

  const { data: usageMap = {} } = useQuery<Record<string, number>>({
    queryKey: ['parts-categories-usage', partsCompanyId],
    queryFn: () => getPartsCategoriesUsage(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const { data: templates = [], isFetching: loadingTemplates } = useQuery({
    queryKey: ['parts-category-templates', templateBrand],
    queryFn: () => getPartsCategoryTemplates(
      templateBrand.trim() || undefined
    ),
    enabled: tab === 'templates',
  })

  const existingNames = new Set(categories.map(c => c.name.toLowerCase()))

  // Недостающие из стандартного набора (по имени, без дублей)
  const missingBaseNames = BASE_CATEGORIES.filter(n => !existingNames.has(n.toLowerCase()))
  const baseAllAdded = missingBaseNames.length === 0

  const createMutation = useMutation({
    mutationFn: (input: CreatePartsCategoryInput) =>
      createPartsCategory(input, partsCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('categoriesPage.toastCategoryAdded'))
      setNewName('')
      setIsAddOpen(false)
    },
    onError: () => toast.error(t('categoriesPage.toastCreateError')),
  })

  const bulkMutation = useMutation({
    mutationFn: (names: string[]) => createPartsCategoriesBulk(names, partsCompanyId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('categoriesPage.toastAddedCount', { n: data.length }))
      setBulkText('')
      setIsAddOpen(false)
    },
    onError: () => toast.error(t('categoriesPage.toastAddError')),
  })

  // Кнопка «Базовые» — добавляет недостающие из стандартного набора BASE_CATEGORIES
  const baseBulkMutation = useMutation({
    mutationFn: (names: string[]) => createPartsCategoriesBulk(names, partsCompanyId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('categoriesPage.toastBaseAddedCount', { n: data.length }))
    },
    onError: () => toast.error(t('categoriesPage.toastAddError')),
  })

  // ── Подкатегории (добавление под родителя: по одной / списком) ──────────
  const [subParentId, setSubParentId] = useState<string | null>(null)
  const [subMode, setSubMode] = useState<AddMode>('single')
  const [subName, setSubName] = useState('')
  const [subBulk, setSubBulk] = useState('')
  const closeSub = () => { setSubParentId(null); setSubName(''); setSubBulk('') }

  const subCreateMutation = useMutation({
    mutationFn: (input: CreatePartsCategoryInput) => createPartsCategory(input, partsCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('categoriesPage.toastSubAdded'))
      setSubName('')
    },
    onError: () => toast.error(t('categoriesPage.toastCreateError')),
  })

  const subBulkMutation = useMutation({
    mutationFn: ({ names, parentId }: { names: string[]; parentId: string }) =>
      createPartsCategoriesBulk(names, partsCompanyId!, parentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('categoriesPage.toastSubAddedCount', { n: data.length }))
      closeSub()
    },
    onError: () => toast.error(t('categoriesPage.toastAddError')),
  })

  const handleAddSub = (e: React.FormEvent, parentId: string) => {
    e.preventDefault()
    if (!subName.trim()) return
    subCreateMutation.mutate({ name: subName.trim(), parent_id: parentId })
  }
  const handleBulkAddSub = (e: React.FormEvent, parentId: string) => {
    e.preventDefault()
    const existing = new Set(categories.filter(c => c.parent_id === parentId).map(c => c.name.toLowerCase()))
    const names = subBulk.split('\n').map(s => s.trim()).filter(s => s.length > 0 && !existing.has(s.toLowerCase()))
    if (!names.length) { toast.error(t('categoriesPage.toastNoNewSub')); return }
    subBulkMutation.mutate({ names, parentId })
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updatePartsCategory(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('categoriesPage.toastUpdated'))
      setEditingId(null)
    },
    onError: () => toast.error(t('categoriesPage.toastUpdateError')),
  })

  const deleteMutation = useMutation({
    // Категории удаляем СРАЗУ, без корзины (по запросу). Подкатегории уходят
    // каскадом (FK parent_id ON DELETE CASCADE).
    mutationFn: async (id: string) => {
      await deletePartsCategory(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(t('categoriesPage.toastDeleted'))
    },
    onError: () => toast.error(t('categoriesPage.toastDeleteError')),
  })

  const copyMutation = useMutation({
    mutationFn: (ids: string[]) => copyTemplateCategories(partsCompanyId!, ids),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      setSelectedTemplateIds(new Set())
      toast.success(t('categoriesPage.toastImportedCount', { n: count }))
    },
    onError: () => toast.error(t('categoriesPage.toastImportError')),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName.trim() })
  }

  const handleBulkAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const names = bulkText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !existingNames.has(s.toLowerCase()))
    if (!names.length) { toast.error(t('categoriesPage.toastNoNew')); return }
    bulkMutation.mutate(names)
  }

  const handleSaveEdit = (id: string) => {
    if (!editingName.trim()) return
    updateMutation.mutate({ id, name: editingName.trim() })
  }

  const handleDelete = async (cat: PartsCategory) => {
    const count = usageMap[cat.id] || 0
    const childCount = categories.filter(c => c.parent_id === cat.id).length
    const parts: string[] = [t('categoriesPage.confirmDelete', { name: cat.name })]
    if (childCount > 0) parts.push(t('categoriesPage.confirmDeleteChildren', { n: childCount }))
    if (count > 0) parts.push(t('categoriesPage.confirmDeleteUsage', { n: count }))
    const ok = await showConfirm({ message: parts.join(' '), danger: true })
    if (!ok) return
    deleteMutation.mutate(cat.id)
  }

  const toggleTemplateSelect = (id: string) => {
    setSelectedTemplateIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAllTemplates = () => {
    setSelectedTemplateIds(new Set(
      templates.filter(tpl => !existingNames.has(tpl.name.toLowerCase())).map(tpl => tpl.id)
    ))
  }

  const bulkPreview = bulkText.split('\n').map(s => s.trim()).filter(s => s.length > 0)
  const bulkNew = bulkPreview.filter(n => !existingNames.has(n.toLowerCase()))
  const bulkDuplicate = bulkPreview.filter(n => existingNames.has(n.toLowerCase()))

  // Строка категории (родитель или вложенная)
  const renderRow = (cat: PartsCategory, isChild: boolean) => {
    const usage = usageMap[cat.id] || 0
    const isEditing = editingId === cat.id
    return (
      <div
        key={cat.id}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
        style={isChild ? { paddingLeft: 40 } : undefined}
      >
        <div className={`icon-tile-sm flex-shrink-0 ${isChild ? 'bg-transparent text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
          {isChild ? <CornerDownRight className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
        </div>
        {isEditing ? (
          <input
            type="text" autoFocus value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(cat.id); if (e.key === 'Escape') setEditingId(null) }}
            className="form-input flex-1"
          />
        ) : (
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-900 truncate">{cat.name}</span>
            {usage > 0 && <span className="ml-2 kicker tabular-nums">{t('categoriesPage.usageParts', { n: usage })}</span>}
          </div>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isEditing ? (
            <>
              <button onClick={() => handleSaveEdit(cat.id)} disabled={updateMutation.isPending} className="btn-icon text-green-600 hover:text-green-700 hover:bg-green-50" title={t('categoriesPage.save')}><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditingId(null)} className="btn-icon" title={t('categoriesPage.cancel')}><X className="w-4 h-4" /></button>
            </>
          ) : (
            <>
              {!isChild && (
                <button onClick={() => { setSubParentId(p => p === cat.id ? null : cat.id); setSubMode('single'); setSubName(''); setSubBulk('') }} className="btn-icon" title={t('categoriesPage.addSub')}>
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => { setEditingId(cat.id); setEditingName(cat.name) }} className="btn-icon" title={t('categoriesPage.rename')}><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(cat)} disabled={deleteMutation.isPending} className="btn-icon hover:text-red-600 hover:bg-red-50" title={t('categoriesPage.delete')}><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Инлайн-форма добавления подкатегорий (по одной / списком)
  const renderSubForm = (parentId: string) => (
    <div className="px-4 py-3 border-t border-gray-100" style={{ paddingLeft: 40, background: 'var(--cab-surface-2)' }}>
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={() => setSubMode('single')} className={subMode === 'single' ? 'cab-chip cab-chip-signal' : 'cab-chip'}><Plus className="w-3.5 h-3.5" />{t('categoriesPage.oneByOne')}</button>
        <button type="button" onClick={() => setSubMode('list')} className={subMode === 'list' ? 'cab-chip cab-chip-signal' : 'cab-chip'}><List className="w-3.5 h-3.5" />{t('categoriesPage.asList')}</button>
      </div>
      {subMode === 'single' ? (
        <form onSubmit={e => handleAddSub(e, parentId)} className="flex gap-2">
          <input type="text" autoFocus value={subName} onChange={e => setSubName(e.target.value)} placeholder={t('categoriesPage.subNamePlaceholder')} className="form-input flex-1" />
          <button type="submit" disabled={!subName.trim() || subCreateMutation.isPending} className="cab-btn cab-btn-primary"><Check className="w-4 h-4" /></button>
          <button type="button" onClick={closeSub} className="cab-btn cab-btn-secondary"><X className="w-4 h-4" /></button>
        </form>
      ) : (
        <form onSubmit={e => handleBulkAddSub(e, parentId)} className="space-y-3">
          <textarea autoFocus value={subBulk} onChange={e => setSubBulk(e.target.value)} placeholder={t('categoriesPage.subBulkPlaceholder')} rows={5} className="form-input font-mono resize-none" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={closeSub} className="cab-btn cab-btn-secondary cab-btn-sm">{t('categoriesPage.cancel')}</button>
            <button type="submit" disabled={subBulkMutation.isPending} className="cab-btn cab-btn-primary cab-btn-sm">{subBulkMutation.isPending ? t('categoriesPage.adding') : t('categoriesPage.add')}</button>
          </div>
        </form>
      )}
    </div>
  )

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title={i18n.t('cabinet:pages.categories')}
        subtitle={i18n.t('cabinet:pages.ownCategories', { n: categories.length })}
        backPath="/parts/inventory"
        height="sm"
        actions={
          tab === 'my' ? (
            <>
              <button
                onClick={() => baseBulkMutation.mutate(missingBaseNames)}
                disabled={baseAllAdded || baseBulkMutation.isPending}
                title={baseAllAdded ? t('categoriesPage.baseAllAddedTitle') : t('categoriesPage.baseAddTitle')}
                className="cab-btn cab-btn-secondary cab-btn-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {baseAllAdded ? t('categoriesPage.baseAdded') : `${t('categoriesPage.base')}${missingBaseNames.length ? ` (${missingBaseNames.length})` : ''}`}
                </span>
              </button>
              <button
                onClick={() => { setIsAddOpen(v => !v); setAddMode('single') }}
                className="cab-btn cab-btn-primary cab-btn-sm flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('categoriesPage.add')}</span>
              </button>
            </>
          ) : undefined
        }
        footer={
          <div className="flex border-t border-gray-100 overflow-x-auto scrollbar-hide">
            {(['my', 'templates'] as Tab[]).map(tabId => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  tab === tabId
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tabId === 'my' ? t('categoriesPage.tabMy') : t('categoriesPage.tabTemplates')}
              </button>
            ))}
          </div>
        }
      />

      <div className="page-container">

        {/* ── Вкладка: Мои категории ─────────────────────────── */}
        {tab === 'my' && (
          <>
            {isAddOpen && (
              <div className="cab-card p-4 mb-4 animate-slide-up">
                {/* Переключатель режима */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setAddMode('single')}
                    className={addMode === 'single' ? 'cab-chip cab-chip-signal' : 'cab-chip'}
                  >
                    <Plus className="w-3.5 h-3.5" />{t('categoriesPage.oneByOne')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('list')}
                    className={addMode === 'list' ? 'cab-chip cab-chip-signal' : 'cab-chip'}
                  >
                    <List className="w-3.5 h-3.5" />{t('categoriesPage.asList')}
                  </button>
                </div>

                {addMode === 'single' ? (
                  <form onSubmit={handleAdd} className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder={t('categoriesPage.namePlaceholder')}
                      className="form-input flex-1"
                    />
                    <button
                      type="submit"
                      disabled={!newName.trim() || createMutation.isPending}
                      className="cab-btn cab-btn-primary"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddOpen(false); setNewName('') }}
                      className="cab-btn cab-btn-secondary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleBulkAdd} className="space-y-3">
                    <textarea
                      autoFocus
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder={t('categoriesPage.bulkPlaceholder')}
                      rows={7}
                      className="form-input font-mono resize-none"
                    />
                    {bulkPreview.length > 0 && (
                      <div className="flex gap-3 text-xs">
                        {bulkNew.length > 0 && (
                          <span className="badge badge-green tabular-nums">
                            {t('categoriesPage.bulkNewCount', { n: bulkNew.length })}
                          </span>
                        )}
                        {bulkDuplicate.length > 0 && (
                          <span className="badge badge-gray tabular-nums">
                            {t('categoriesPage.bulkDuplicateCount', { n: bulkDuplicate.length })}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setIsAddOpen(false); setBulkText('') }}
                        className="cab-btn cab-btn-secondary cab-btn-sm"
                      >
                        {t('categoriesPage.cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={!bulkNew.length || bulkMutation.isPending}
                        className="cab-btn cab-btn-primary cab-btn-sm"
                      >
                        {bulkMutation.isPending ? t('categoriesPage.adding') : `${t('categoriesPage.add')} ${bulkNew.length || ''}`}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner size="xl" />
              </div>
            ) : categories.length === 0 ? (
              <div className="cab-card p-4">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Tag className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="empty-state-title">{t('categoriesPage.emptyTitle')}</p>
                  <p className="empty-state-text">{t('categoriesPage.emptyText')}</p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-6">
                    <button
                      onClick={() => { setIsAddOpen(true); setAddMode('single') }}
                      className="cab-btn cab-btn-primary cab-btn-sm"
                    >
                      {t('categoriesPage.add')}
                    </button>
                    <button
                      onClick={() => setTab('templates')}
                      className="cab-btn cab-btn-secondary cab-btn-sm"
                    >
                      {t('categoriesPage.importTemplates')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cab-card overflow-hidden">
                <div className="panel-divided">
                  {categories.filter(c => !c.parent_id).map((cat) => {
                    const children = categories.filter(c => c.parent_id === cat.id)
                    return (
                      <div key={cat.id}>
                        {renderRow(cat, false)}
                        {children.map(ch => renderRow(ch, true))}
                        {subParentId === cat.id && renderSubForm(cat.id)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Вкладка: Стандартные шаблоны ──────────────────── */}
        {tab === 'templates' && (
          <>
            {/* Поиск по марке */}
            <div className="cab-card p-4 mb-4">
              <p className="text-sm text-gray-500 mb-3">
                {t('categoriesPage.templatesHint')}
              </p>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={templateBrand}
                  onChange={e => setTemplateBrand(e.target.value)}
                  placeholder={t('categoriesPage.brandPlaceholder')}
                  className="form-input pl-10"
                />
              </div>
            </div>

            {/* Sticky-панель выбранных */}
            {selectedTemplateIds.size > 0 && (
              <div className="sticky top-16 z-20 mb-4 animate-slide-up">
                <div
                  className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{ background: 'var(--cab-ink)' }}
                >
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {t('categoriesPage.selectedCount', { n: selectedTemplateIds.size })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTemplateIds(new Set())}
                      className="cab-btn-sm rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors font-medium"
                    >
                      {t('categoriesPage.reset')}
                    </button>
                    <button
                      onClick={() => copyMutation.mutate(Array.from(selectedTemplateIds))}
                      disabled={copyMutation.isPending}
                      className="cab-btn-sm rounded-lg bg-white text-primary font-semibold hover:bg-white/90 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {copyMutation.isPending ? t('categoriesPage.importing') : t('categoriesPage.import')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingTemplates ? (
              <div className="flex justify-center py-16">
                <Spinner size="xl" />
              </div>
            ) : templates.length === 0 ? (
              <div className="cab-card p-4">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Tag className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="empty-state-title">{t('categoriesPage.templatesEmpty')}</p>
                  {templateBrand && (
                    <button
                      onClick={() => setTemplateBrand('')}
                      className="mt-3 text-sm font-medium text-primary hover:underline"
                    >
                      {t('categoriesPage.showAll')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="cab-card overflow-hidden">
                {/* Шапка таблицы */}
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="kicker tabular-nums">
                    {t('categoriesPage.templatesCount', { n: templates.length })}
                    {templates.filter(tpl => existingNames.has(tpl.name.toLowerCase())).length > 0 &&
                      ` · ${t('categoriesPage.alreadyYours', { n: templates.filter(tpl => existingNames.has(tpl.name.toLowerCase())).length })}`}
                  </span>
                  <button
                    onClick={selectAllTemplates}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {t('categoriesPage.selectAllNew')}
                  </button>
                </div>

                <div className="panel-divided">
                  {templates.map(tpl => {
                    const alreadyHave = existingNames.has(tpl.name.toLowerCase())
                    const isSelected = selectedTemplateIds.has(tpl.id)
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={alreadyHave}
                        onClick={() => !alreadyHave && toggleTemplateSelect(tpl.id)}
                        className={[
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                          alreadyHave
                            ? 'opacity-40 cursor-not-allowed bg-gray-50'
                            : isSelected
                              ? 'bg-primary/5 hover:bg-primary/10'
                              : 'hover:bg-gray-50',
                        ].join(' ')}
                      >
                        {/* Чекбокс */}
                        <div
                          className={[
                            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                            alreadyHave
                              ? 'border-gray-300 bg-gray-100'
                              : isSelected
                                ? 'border-primary bg-primary'
                                : 'border-gray-300',
                          ].join(' ')}
                        >
                          {(isSelected || alreadyHave) && (
                            <Check className={`w-3 h-3 ${alreadyHave ? 'text-gray-400' : 'text-white'}`} />
                          )}
                        </div>

                        {/* Название */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {tpl.name}
                          </span>
                          {tpl.template_type && tpl.template_type !== 'global' && (
                            <span className="ml-2 kicker">
                              {tpl.brand}{tpl.model ? ` · ${tpl.model}` : ''}
                            </span>
                          )}
                        </div>

                        {alreadyHave && (
                          <span className="badge badge-gray flex-shrink-0">{t('categoriesPage.have')}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
