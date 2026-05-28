import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Tag, X, Check, List, Download, Search } from 'lucide-react'
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
  getPartsCategoryById,
} from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'

import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { PartsCategory, CreatePartsCategoryInput } from '@/types/parts'

type Tab = 'my' | 'templates'
type AddMode = 'single' | 'list'

export default function PartsCategories() {
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

  const createMutation = useMutation({
    mutationFn: (input: CreatePartsCategoryInput) =>
      createPartsCategory(input, partsCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success('Категория добавлена')
      setNewName('')
      setIsAddOpen(false)
    },
    onError: () => toast.error('Ошибка при создании'),
  })

  const bulkMutation = useMutation({
    mutationFn: (names: string[]) => createPartsCategoriesBulk(names, partsCompanyId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success(`Добавлено ${data.length} категорий`)
      setBulkText('')
      setIsAddOpen(false)
    },
    onError: () => toast.error('Ошибка при добавлении'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updatePartsCategory(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success('Обновлено')
      setEditingId(null)
    },
    onError: () => toast.error('Ошибка при обновлении'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const category = await getPartsCategoryById(id).catch(() => null)
      if (category) {
        await moveToTrash({
          entityType: 'parts_category',
          entityId: id,
          entityLabel: category.name || 'Категория',
          entityData: category,
          partsCompanyId,
        })
      }
      await deletePartsCategory(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success('Удалено')
    },
    onError: () => toast.error('Нельзя удалить — категория используется'),
  })

  const copyMutation = useMutation({
    mutationFn: (ids: string[]) => copyTemplateCategories(partsCompanyId!, ids),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      setSelectedTemplateIds(new Set())
      toast.success(`Добавлено ${count} категорий из стандартных`)
    },
    onError: () => toast.error('Ошибка при импорте'),
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
    if (!names.length) { toast.error('Нет новых категорий для добавления'); return }
    bulkMutation.mutate(names)
  }

  const handleSaveEdit = (id: string) => {
    if (!editingName.trim()) return
    updateMutation.mutate({ id, name: editingName.trim() })
  }

  const handleDelete = async (cat: PartsCategory) => {
    const count = usageMap[cat.id] || 0
    const msg = count > 0
      ? `Категория используется в ${count} запчастях. Продолжить?`
      : `Удалить категорию "${cat.name}"?`
    const ok = await showConfirm({ message: msg, danger: true })
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
      templates.filter(t => !existingNames.has(t.name.toLowerCase())).map(t => t.id)
    ))
  }

  const bulkPreview = bulkText.split('\n').map(s => s.trim()).filter(s => s.length > 0)
  const bulkNew = bulkPreview.filter(n => !existingNames.has(n.toLowerCase()))
  const bulkDuplicate = bulkPreview.filter(n => existingNames.has(n.toLowerCase()))

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title="Категории запчастей"
        subtitle={`${categories.length} своих категорий`}
        backPath="/parts/inventory"
        height="sm"
        actions={
          tab === 'my' ? (
            <button
              onClick={() => { setIsAddOpen(v => !v); setAddMode('single') }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Добавить</span>
            </button>
          ) : undefined
        }
        footer={
          <div className="flex border-t">
            {(['my', 'templates'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'my' ? 'Мои категории' : 'Стандартные'}
              </button>
            ))}
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {tab === 'my' && (
          <>
            {isAddOpen && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => setAddMode('single')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${addMode === 'single' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    <Plus className="w-3.5 h-3.5" />По одной
                  </button>
                  <button type="button" onClick={() => setAddMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${addMode === 'list' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    <List className="w-3.5 h-3.5" />Списком
                  </button>
                </div>

                {addMode === 'single' ? (
                  <form onSubmit={handleAdd} className="flex gap-2">
                    <input type="text" autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="Название категории..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base" />
                    <button type="submit" disabled={!newName.trim() || createMutation.isPending}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                      <Check className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={() => { setIsAddOpen(false); setNewName('') }}
                      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                      <X className="w-5 h-5" />
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleBulkAdd} className="space-y-3">
                    <textarea autoFocus value={bulkText} onChange={e => setBulkText(e.target.value)}
                      placeholder={'Двигатель\nКоробка передач\nПодвеска\nОптика\n...'}
                      rows={7}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm font-mono resize-none" />
                    {bulkPreview.length > 0 && (
                      <div className="flex gap-3 text-xs">
                        {bulkNew.length > 0 && <span className="text-green-600 font-medium">+ {bulkNew.length} новых</span>}
                        {bulkDuplicate.length > 0 && <span className="text-gray-400">{bulkDuplicate.length} уже есть — пропустятся</span>}
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setIsAddOpen(false); setBulkText('') }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Отмена</button>
                      <button type="submit" disabled={!bulkNew.length || bulkMutation.isPending}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium">
                        {bulkMutation.isPending ? 'Добавляем...' : `Добавить ${bulkNew.length || ''}`}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="xl" />
              </div>
            ) : categories.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-1">Категорий пока нет</p>
                <p className="text-xs text-gray-400 mb-4">Добавьте вручную или импортируйте стандартные</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button onClick={() => { setIsAddOpen(true); setAddMode('single') }}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">Добавить</button>
                  <button onClick={() => setTab('templates')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Импортировать стандартные</button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {categories.map((cat) => {
                    const usage = usageMap[cat.id] || 0
                    const isEditing = editingId === cat.id
                    return (
                      <div key={cat.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Tag className="w-4 h-4 text-primary" />
                        </div>
                        {isEditing ? (
                          <input type="text" autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                            className="flex-1 px-3 py-1.5 border border-primary rounded-lg focus:ring-2 focus:ring-primary text-base" />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900">{cat.name}</span>
                            {usage > 0 && <span className="ml-2 text-xs text-gray-400">{usage} запч.</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEdit(cat.id)} disabled={updateMutation.isPending}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingId(null)}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingId(cat.id); setEditingName(cat.name) }}
                                className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(cat)} disabled={deleteMutation.isPending}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'templates' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <p className="text-sm text-gray-500 mb-3">Стандартные категории от администратора по марке авто. Выберите нужные и импортируйте в свой список.</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="text" value={templateBrand} onChange={e => setTemplateBrand(e.target.value)}
                  placeholder="Марка (Toyota, BMW, Ford…)"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-base" />
              </div>
            </div>

            {selectedTemplateIds.size > 0 && (
              <div className="sticky top-16 z-10 bg-primary text-white rounded-xl px-4 py-3 mb-4 flex items-center justify-between shadow-lg">
                <span className="text-sm font-medium">Выбрано: {selectedTemplateIds.size}</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedTemplateIds(new Set())}
                    className="px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors">Сбросить</button>
                  <button onClick={() => copyMutation.mutate(Array.from(selectedTemplateIds))} disabled={copyMutation.isPending}
                    className="px-3 py-1.5 bg-white text-primary rounded-lg text-sm font-semibold hover:bg-white/90 disabled:opacity-50 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    {copyMutation.isPending ? 'Импорт...' : 'Импортировать'}
                  </button>
                </div>
              </div>
            )}

            {loadingTemplates ? (
              <div className="flex justify-center py-12">
                <Spinner size="xl" />
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Стандартных категорий не найдено</p>
                {templateBrand && (
                  <button onClick={() => setTemplateBrand('')}
                    className="mt-2 text-primary hover:underline text-sm">Показать все</button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {templates.length} категорий
                    {templates.filter(t => existingNames.has(t.name.toLowerCase())).length > 0 &&
                      ` · ${templates.filter(t => existingNames.has(t.name.toLowerCase())).length} уже у вас`}
                  </span>
                  <button onClick={selectAllTemplates} className="text-xs text-primary hover:underline font-medium">Выбрать все новые</button>
                </div>
                <div className="divide-y divide-gray-100">
                  {templates.map(t => {
                    const alreadyHave = existingNames.has(t.name.toLowerCase())
                    const isSelected = selectedTemplateIds.has(t.id)
                    return (
                      <button key={t.id} type="button" disabled={alreadyHave}
                        onClick={() => !alreadyHave && toggleTemplateSelect(t.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${alreadyHave ? 'opacity-40 cursor-not-allowed bg-gray-50' : isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-gray-50'}`}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${alreadyHave ? 'border-gray-300 bg-gray-100' : isSelected ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                          {(isSelected || alreadyHave) && <Check className={`w-3 h-3 ${alreadyHave ? 'text-gray-400' : 'text-white'}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{t.name}</span>
                          {t.template_type && t.template_type !== 'global' && (
                            <span className="ml-2 text-xs text-gray-400">{t.brand}{t.model ? ` · ${t.model}` : ''}</span>
                          )}
                        </div>
                        {alreadyHave && <span className="text-xs text-gray-400 flex-shrink-0">есть</span>}
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
