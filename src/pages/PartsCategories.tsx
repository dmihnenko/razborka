import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, Tag, X, Check } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  getPartsCategories,
  createPartsCategory,
  updatePartsCategory,
  deletePartsCategory,
} from '@/services/partsService'
import type { PartsCategory, CreatePartsCategoryInput } from '@/types/parts'

export default function PartsCategories() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')

  // Fetch только кастомные категории компании (не шаблоны)
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['parts-categories-manage', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return []
      const all = await getPartsCategories(partsCompanyId)
      // Показываем только свои категории (не глобальные шаблоны)
      return all.filter(c => c.parts_company_id === partsCompanyId)
    },
    enabled: !!partsCompanyId,
  })

  // Подсказки использования каждой категории
  const { data: usageMap = {} } = useQuery<Record<string, number>>({
    queryKey: ['parts-categories-usage', partsCompanyId],
    queryFn: async () => {
      const { data } = await import('@/lib/supabase').then(m =>
        m.supabase
          .from('parts_inventory')
          .select('category_id')
          .eq('parts_company_id', partsCompanyId!)
      )
      const map: Record<string, number> = {}
      ;(data || []).forEach(row => {
        if (row.category_id) map[row.category_id] = (map[row.category_id] || 0) + 1
      })
      return map
    },
    enabled: !!partsCompanyId,
  })

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

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updatePartsCategory(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success('Категория обновлена')
      setEditingId(null)
    },
    onError: () => toast.error('Ошибка при обновлении'),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePartsCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success('Категория удалена')
    },
    onError: () => toast.error('Нельзя удалить — категория используется'),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName.trim() })
  }

  const handleStartEdit = (cat: PartsCategory) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
  }

  const handleSaveEdit = (id: string) => {
    if (!editingName.trim()) return
    updateMutation.mutate({ id, name: editingName.trim() })
  }

  const handleDelete = (cat: PartsCategory) => {
    const count = usageMap[cat.id] || 0
    const msg = count > 0
      ? `Категория используется в ${count} запчастях. После удаления они останутся без категории. Продолжить?`
      : `Удалить категорию "${cat.name}"?`
    if (confirm(msg)) deleteMutation.mutate(cat.id)
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-600">У вас нет доступа к разборке</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/parts/inventory')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Категории запчастей</h1>
                <p className="text-sm text-gray-500 hidden sm:block">
                  {categories.length} категорий
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Добавить</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Add form */}
        {isAddOpen && (
          <form onSubmit={handleAdd} className="bg-white rounded-lg shadow-sm p-4 mb-4 flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Название категории..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
              />
            </div>
            <button
              type="submit"
              disabled={!newName.trim() || createMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => { setIsAddOpen(false); setNewName('') }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </form>
        )}

        {/* Categories list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Категорий пока нет</p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-2 text-primary hover:underline text-sm"
            >
              Добавить первую категорию
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {categories.map((cat) => {
                const usage = usageMap[cat.id] || 0
                const isEditing = editingId === cat.id

                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Tag className="w-4 h-4 text-primary" />
                    </div>

                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(cat.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 px-3 py-1.5 border border-primary rounded-lg focus:ring-2 focus:ring-primary text-base"
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{cat.name}</span>
                        {usage > 0 && (
                          <span className="ml-2 text-xs text-gray-400">{usage} запч.</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(cat.id)}
                            disabled={updateMutation.isPending}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(cat)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
