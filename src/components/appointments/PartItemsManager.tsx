import { useState } from 'react'
import { PartItem } from '@/types/appointments'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  items: PartItem[]
  onChange: (items: PartItem[]) => void
}

export default function PartItemsManager({ items, onChange }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<PartItem>>({
    name: '',
    quantity: 1,
    price: 0,
    isPaid: false,
  })

  const totalPrice = formData.quantity && formData.price ? formData.quantity * formData.price : 0
  const totalCost = items.reduce((sum, item) => sum + item.totalPrice, 0)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    
    const partItem: PartItem = {
      ...formData as PartItem,
      id: editingId || uuidv4(),
      totalPrice: (formData.quantity || 1) * (formData.price || 0),
      isPaid: false,
    }
    
    if (editingId) {
      onChange(items.map(item => item.id === editingId ? partItem : item))
    } else {
      onChange([...items, partItem])
    }
    
    setFormData({ name: '', quantity: 1, price: 0, isPaid: false })
    setShowForm(false)
    setEditingId(null)
  }

  const handleEdit = (item: PartItem) => {
    setFormData(item)
    setEditingId(item.id)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    onChange(items.filter(item => item.id !== id))
  }

  const conditionLabels: Record<string, string> = {
    'new-original': '🆕 Новая оригинал',
    'used-original': '♻️ Б/у оригинал',
    'aftermarket': '🔧 Неоригинал',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Запчасти</h3>
        <button
          onClick={() => {
            setFormData({ name: '', quantity: 1, price: 0, isPaid: false })
            setEditingId(null)
            setShowForm(!showForm)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Добавить запчасть
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
          <h4 className="font-semibold mb-3">{editingId ? 'Редактировать запчасть' : 'Новая запчасть'}</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Количество *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена за ед. *</label>
              <input
                type="number"
                required
                min="0"
                step="10"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Общая цена</label>
              <input
                type="number"
                disabled
                value={totalPrice}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 font-semibold"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3 flex-1">
              <Package className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-600">
                  {item.articleNumber && `${item.articleNumber} • `}
                  {item.quantity} шт × {item.price} грн
                  {item.condition && ` • ${conditionLabels[item.condition]}`}
                </div>
              </div>
              <div className="font-semibold text-primary">{item.totalPrice} грн</div>
            </div>
            <div className="flex gap-2 ml-4">
              <button onClick={() => handleEdit(item)} className="p-2 text-primary hover:bg-blue-50 rounded">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-500">
          Запчасти опциональны. Можете пропустить этот шаг.
        </div>
      )}

      {items.length > 0 && (
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg font-semibold">
          <span>Итого запчастей:</span>
          <span className="text-lg text-primary">{totalCost.toLocaleString()} грн</span>
        </div>
      )}
    </div>
  )
}
