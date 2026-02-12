import { useState } from 'react'
import { WorkItem } from '@/types/appointments'
import { Trash2, Wrench } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  items: WorkItem[]
  onChange: (items: WorkItem[]) => void
}

export default function WorkItemsManager({ items, onChange }: Props) {
  const [workListText, setWorkListText] = useState('')

  const totalCost = items.reduce((sum, item) => sum + item.price, 0)

  const parseWorkItems = (text: string): WorkItem[] => {
    const lines = text.split('\n').filter(line => line.trim())
    const parsed: WorkItem[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      // Ищем последнее число в строке
      const match = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/)
      if (match) {
        const name = match[1].trim()
        const price = parseFloat(match[2])
        if (name && !isNaN(price)) {
          parsed.push({
            id: uuidv4(),
            name,
            price,
            isPaid: false,
          })
        }
      }
    }
    return parsed
  }

  const handleTextChange = (text: string) => {
    setWorkListText(text)
    const newItems = parseWorkItems(text)
    if (newItems.length > 0) {
      onChange(newItems)
    } else {
      onChange([])
    }
  }

  const handleDelete = (id: string) => {
    onChange(items.filter(item => item.id !== id))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Работы</h3>

      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Список работ (каждая строка: название цена)
          </label>
          <textarea
            value={workListText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Замена корыта 500&#10;Покраска бампера 1200&#10;Диагностика ходовой 300"
          />
          <p className="text-xs text-gray-500 mt-1">
            Пример: "Замена корыта 500" — название "Замена корыта", цена 500
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3 flex-1">
              <Wrench className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
              </div>
              <div className="font-semibold text-primary">{item.price} грн</div>
            </div>
            <div className="flex gap-2 ml-4">
              <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg font-semibold">
          <span>Итого работ:</span>
          <span className="text-lg text-primary">{totalCost.toLocaleString()} грн</span>
        </div>
      )}
    </div>
  )
}
