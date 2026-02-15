import { useState } from 'react'
import { PartItem } from '@/types/appointments'
import { Plus, Trash2, Package } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  items: PartItem[]
  onChange: (items: PartItem[]) => void
}

export default function PartItemsManager({ items, onChange }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [textInput, setTextInput] = useState('')

  const calculateTotalPrice = (
    price: number,
    markup: number,
    markupType: 'percentage' | 'fixed',
    quantity: number
  ): number => {
    let pricePerUnit: number
    if (markupType === 'percentage') {
      pricePerUnit = price * (1 + markup / 100)
    } else {
      pricePerUnit = price + markup
    }
    return pricePerUnit * quantity
  }

  const handleSave = () => {
    if (!textInput.trim()) return
    
    // Парсим каждую строку: название цена
    const lines = textInput.trim().split('\n').filter(line => line.trim())
    const newItems: PartItem[] = []
    
    for (const line of lines) {
      // Убираем валюту (грн, UAH и т.д.) из конца строки
      const cleanLine = line.trim().replace(/\s+(грн|uah|₴|гривен|гривні)$/i, '')
      const parts = cleanLine.trim().split(/\s+/)
      if (parts.length < 2) continue
      
      let name: string
      let itemPrice: number
      // let markup: number = 0
      
      // Проверяем последний элемент - это цена
      const lastPart = parseFloat(parts[parts.length - 1])
      
      if (!isNaN(lastPart)) {
        // Есть число - это цена
        name = parts.slice(0, -1).join(' ')
        itemPrice = lastPart
      } else {
        continue
      }
      
      const totalPrice = itemPrice // + markup
      
      newItems.push({
        id: uuidv4(),
        name,
        price: itemPrice,
        // markup,
        // markupType: 'fixed',
        quantity: 1,
        totalPrice,
        isPaid: false,
      })
    }
    
    onChange([...items, ...newItems])
    setTextInput('')
    setShowForm(false)
  }

  const handleCancel = () => {
    setShowForm(false)
    setTextInput('')
  }

  const handleDelete = (id: string) => {
    onChange(items.filter(item => item.id !== id))
  }

  const totalCost = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Запчасти</h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить запчасть
          </button>
        )}
      </div>

      {showForm && (
        <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
          <h4 className="font-semibold mb-3">Добавить запчасти</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Список запчастей
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                placeholder="Введите список запчастей (каждая строка: название цена):&#10;Масляный фильтр 100&#10;Воздушный фильтр 200&#10;Свечи зажигания 300"
              />
              <p className="text-xs text-gray-500 mt-1">
                Формат: название цена
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
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
                  Цена: ₴{(item.price || 0).toFixed(2)}
                  {/* {(item.markup || 0) > 0 && ` | Наценка: ₴${(item.markup || 0).toFixed(2)}`} */}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-gray-900">₴{(item.totalPrice || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Итого</div>
                </div>
                <div className="flex gap-1">
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

          {items.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border-2 border-primary/20 mt-3">
              <span className="font-semibold text-gray-900">Итого:</span>
              <span className="text-xl font-bold text-primary">₴{totalCost.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
