import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function Parts() {
  // DEPRECATED: эта страница работает с устаревшей таблицей `parts` (legacy-склад).
  // Новый склад запчастей — src/pages/PartsInventory.tsx (таблица parts_inventory).
  // Прямое удаление здесь намеренно — таблица `parts` не поддерживает корзину.
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<any>(null)
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('name')
      
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] })
      toast.success('Запчасть удалена')
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Склад запчастей</h1>
        <button
          onClick={() => {
            setEditingPart(null)
            setIsModalOpen(true)
          }}
          className="flex items-center px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90"
        >
          <Plus className="w-5 h-5 mr-2" />
          Добавить запчасть
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Название
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Артикул
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Количество
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Поставщик
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {parts?.map((part) => {
                const isLowStock = part.quantity_in_stock <= part.min_quantity
                return (
                  <tr key={part.id} className={isLowStock ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {isLowStock && (
                          <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{part.name}</div>
                          {part.description && (
                            <div className="text-sm text-gray-500">{part.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {part.part_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{part.quantity_in_stock} шт</div>
                      <div className="text-xs text-gray-500">мин: {part.min_quantity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {part.price.toLocaleString('ru-RU')} ₴
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {part.supplier || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingPart(part)
                          setIsModalOpen(true)
                        }}
                        className="text-primary hover:text-primary/80 mr-3"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await showConfirm({ message: 'Удалить эту запчасть?', danger: true })
                          if (!ok) return
                          deleteMutation.mutate(part.id)
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <PartModal
          part={editingPart}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

function PartModal({ part, onClose }: { part: any; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: part?.name || '',
    part_number: part?.part_number || '',
    description: part?.description || '',
    quantity_in_stock: part?.quantity_in_stock || 0,
    min_quantity: part?.min_quantity || 0,
    price: part?.price || '',
    supplier: part?.supplier || '',
  })

  useBlockScroll(true)

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const partData = {
        ...data,
        quantity_in_stock: Number(data.quantity_in_stock),
        min_quantity: Number(data.min_quantity),
        price: Number(data.price),
      }

      if (part) {
        const { error } = await supabase
          .from('parts')
          .update(partData)
          .eq('id', part.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('parts').insert([partData])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] })
      toast.success(part ? 'Запчасть обновлена' : 'Запчасть добавлена')
      onClose()
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {part ? 'Редактировать запчасть' : 'Добавить запчасть'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Название *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Артикул</label>
            <input
              type="text"
              value={formData.part_number}
              onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Количество *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.quantity_in_stock}
                onChange={(e) => setFormData({ ...formData, quantity_in_stock: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Мин. остаток *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Цена (₴) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Поставщик</label>
            <input
              type="text"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
