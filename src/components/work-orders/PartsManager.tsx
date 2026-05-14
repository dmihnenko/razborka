import { useState } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'

export interface WorkOrderPartItem {
  id: string
  name: string
  purchasePrice: number
  markup: number
  markupType: 'percentage' | 'fixed'
  quantity: number
  totalPrice: number
}

interface Props {
  items: WorkOrderPartItem[]
  onChange: (items: WorkOrderPartItem[]) => void
}

export default function PartsManager({ items, onChange }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    purchasePrice: '',
    markup: '',
    markupType: 'percentage' as 'percentage' | 'fixed',
    quantity: '1',
  })

  const calculateTotalPrice = (
    purchasePrice: number,
    markup: number,
    markupType: 'percentage' | 'fixed',
    quantity: number
  ): number => {
    let pricePerUnit: number
    if (markupType === 'percentage') {
      pricePerUnit = purchasePrice * (1 + markup / 100)
    } else {
      pricePerUnit = purchasePrice + markup
    }
    return pricePerUnit * quantity
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const purchasePrice = parseFloat(formData.purchasePrice)
    const markup = parseFloat(formData.markup)
    const quantity = parseInt(formData.quantity)

    if (!formData.name || isNaN(purchasePrice) || isNaN(markup) || isNaN(quantity)) {
      return
    }

    const totalPrice = calculateTotalPrice(purchasePrice, markup, formData.markupType, quantity)

    const newItem: WorkOrderPartItem = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      purchasePrice,
      markup,
      markupType: formData.markupType,
      quantity,
      totalPrice,
    }

    if (editingId) {
      onChange(items.map((item) => (item.id === editingId ? newItem : item)))
      setEditingId(null)
    } else {
      onChange([...items, newItem])
    }

    setFormData({ name: '', purchasePrice: '', markup: '', markupType: 'percentage', quantity: '1' })
    setIsAdding(false)
  }

  const handleEdit = (item: WorkOrderPartItem) => {
    setFormData({
      name: item.name,
      purchasePrice: item.purchasePrice.toString(),
      markup: item.markup.toString(),
      markupType: item.markupType,
      quantity: item.quantity.toString(),
    })
    setEditingId(item.id)
    setIsAdding(true)
  }

  const handleDelete = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ name: '', purchasePrice: '', markup: '', markupType: 'percentage', quantity: '1' })
  }

  const totalCost = items.reduce((sum, item) => sum + item.totalPrice, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Запчасти</h3>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center px-3 py-1.5 text-sm text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить запчасть
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название запчасти *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Например: Масляный фильтр"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Закупочная цена (₴) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Наценка *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={formData.markup}
                  onChange={(e) => setFormData({ ...formData, markup: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0"
                  required
                />
                <select
                  value={formData.markupType}
                  onChange={(e) => setFormData({ ...formData, markupType: e.target.value as 'percentage' | 'fixed' })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="percentage">%</option>
                  <option value="fixed">₴</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество *
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Итоговая цена
              </label>
              <div className="px-3 py-2 bg-gray-100 rounded-lg font-semibold text-gray-900">
                ₴
                {formData.purchasePrice && formData.markup && formData.quantity
                  ? calculateTotalPrice(
                      parseFloat(formData.purchasePrice),
                      parseFloat(formData.markup),
                      formData.markupType,
                      parseInt(formData.quantity)
                    ).toFixed(2)
                  : '0.00'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Отмена
            </button><button
              type="submit"
              className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              {editingId ? 'Сохранить изменения' : 'Добавить'}
            </button>
            
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p>Запчасти не добавлены</p>
          <p className="text-sm mt-1">Нажмите "Добавить запчасть" для начала</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Закупка: ₴{item.purchasePrice.toFixed(2)} | Наценка:{' '}
                  {item.markupType === 'percentage' ? `${item.markup}%` : `₴${item.markup.toFixed(2)}`} | 
                  Кол-во: {item.quantity}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-gray-900">₴{item.totalPrice.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Итого</div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
            <span className="font-semibold text-gray-900">Общая стоимость запчастей:</span>
            <span className="text-xl font-bold text-primary">₴{totalCost.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
