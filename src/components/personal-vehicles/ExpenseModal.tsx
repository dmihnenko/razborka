import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { PersonalCostItem, CostCategory, CostCurrency, PartCondition } from '@/types/personalVehicles'
import { CONDITION_LABELS } from '@/types/personalVehicles'
import { deleteExpenseItem } from '@/services/personalVehicles'
import { useAlert } from '../CustomAlert'
import { useBlockScroll } from '@/hooks/useBlockScroll'

interface Props {
  isOpen: boolean
  onClose: () => void
  category: CostCategory
  editItem?: PersonalCostItem
  onSave: (item: PersonalCostItem) => void
  onSaveBulk?: (items: PersonalCostItem[]) => void
  vehicleId: string
  onUpdate: () => void
}

interface ParsedItem {
  name: string
  cost: number
  currency: CostCurrency
  selected: boolean
}

export default function ExpenseModal({ isOpen, onClose, category, editItem, onSave, onSaveBulk, vehicleId, onUpdate }: Props) {
  const { showAlert } = useAlert()
  useBlockScroll(isOpen)
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [showParsedPreview, setShowParsedPreview] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    currency: 'USD' as CostCurrency,
    condition: 'new-original' as PartCondition
  })

  useEffect(() => {
    if (editItem) {
      setIsBulkMode(false)
      setShowParsedPreview(false)
      setParsedItems([])
      setFormData({
        name: editItem.name,
        cost: editItem.cost.toString(),
        currency: editItem.currency,
        condition: editItem.condition || 'new-original'
      })
    } else {
      setIsBulkMode(false)
      setBulkText('')
      setShowParsedPreview(false)
      setParsedItems([])
      setFormData({
        name: '',
        cost: '',
        currency: 'USD',
        condition: 'new-original'
      })
    }
  }, [editItem, isOpen])

  const parseBulkText = (text: string): ParsedItem[] => {
    const lines = text.trim().split('\n').filter(line => line.trim())
    const items: ParsedItem[] = []
    
    for (const line of lines) {
      // Парсим строку: "название сумма валюта" или "название сумма" (USD по умолчанию)
      const parts = line.trim().split(/\s+/)
      if (parts.length < 2) continue
      
      const currency = parts[parts.length - 1].toUpperCase()
      let cost: number
      let name: string
      let itemCurrency: CostCurrency = 'USD'
      
      if (currency === 'USD' || currency === 'UAH') {
        // Последний элемент - валюта
        cost = parseFloat(parts[parts.length - 2])
        name = parts.slice(0, -2).join(' ')
        itemCurrency = currency as CostCurrency
      } else {
        // Нет валюты, используем USD по умолчанию
        cost = parseFloat(parts[parts.length - 1])
        name = parts.slice(0, -1).join(' ')
      }
      
      if (isNaN(cost) || cost < 0 || !name) continue
      
      items.push({
        name,
        cost,
        currency: itemCurrency,
        selected: true
      })
    }
    
    return items
  }

  const handleParseBulkText = (e: React.FormEvent) => {
    e.preventDefault()
    const items = parseBulkText(bulkText)
    if (items.length === 0) {
      showAlert('Не удалось распарсить ни одного расхода. Формат: название сумма валюта', 'error')
      return
    }
    setParsedItems(items)
    setShowParsedPreview(true)
  }

  const handleToggleItem = (index: number) => {
    setParsedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }

  const handleChangeCurrency = (index: number, currency: CostCurrency) => {
    setParsedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, currency } : item
    ))
  }

  const handleSaveParsedItems = () => {
    const selectedItems = parsedItems
      .filter(item => item.selected)
      .map((item, index) => ({
        id: `${Date.now()}-${index}`,
        name: item.name,
        cost: item.cost,
        currency: item.currency,
        category,
        ...(category === 'parts' && { condition: 'new-original' as PartCondition })
      }))

    if (selectedItems.length === 0) {
      showAlert('Выберите хотя бы один расход', 'error')
      return
    }

    if (onSaveBulk) {
      onSaveBulk(selectedItems)
      onClose()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const cost = parseFloat(formData.cost)
    if (isNaN(cost) || cost < 0) {
      showAlert('Введите корректную сумму', 'error')
      return
    }

    const item: PersonalCostItem = {
      id: editItem?.id || Date.now().toString(),
      name: formData.name.trim(),
      cost,
      currency: formData.currency,
      category,
      ...(category === 'parts' && { condition: formData.condition })
    }

    onSave(item)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b sticky top-0 bg-white z-10">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {editItem ? 'Редактировать расход' : 'Добавить расход'}
          </h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {!editItem && !showParsedPreview && onSaveBulk && (
            <div className="flex items-center gap-3 pb-3 sm:pb-4 border-b mb-3 sm:mb-4">
              <label htmlFor="bulk-mode" className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    id="bulk-mode"
                    checked={isBulkMode}
                    onChange={(e) => setIsBulkMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center transition-all peer-checked:bg-blue-700 peer-checked:border-blue-600 group-hover:border-blue-400">
                    {isBulkMode && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Добавить списком
                </span>
              </label>
            </div>
          )}

          {showParsedPreview ? (
            <div>
              <div className="mb-3 sm:mb-4">
                <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-1.5 sm:mb-2">Выберите расходы для добавления:</h4>
                <p className="text-xs sm:text-sm text-gray-600">Отметьте нужные расходы и выберите валюту для каждого</p>
              </div>

              <div className="space-y-2 mb-4 sm:mb-6 max-h-60 sm:max-h-96 overflow-y-auto">
                {parsedItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => handleToggleItem(index)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs sm:text-sm text-gray-900 font-medium truncate block">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <span className="text-xs sm:text-sm text-gray-900 font-semibold">{item.cost}</span>
                      <div className="flex gap-0.5 sm:gap-1">
                        <button
                          type="button"
                          onClick={() => handleChangeCurrency(index, 'USD')}
                          className={`px-1.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded transition-colors ${
                            item.currency === 'USD'
                              ? 'bg-blue-700 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          <span className="hidden sm:inline">$USD</span>
                          <span className="sm:hidden">$</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeCurrency(index, 'UAH')}
                          className={`px-1.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded transition-colors ${
                            item.currency === 'UAH'
                              ? 'bg-blue-700 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          <span className="hidden sm:inline">UAH</span>
                          <span className="sm:hidden">грн</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleSaveParsedItems}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors font-medium text-xs sm:text-sm"
                >
                  Добавить выбранные ({parsedItems.filter(i => i.selected).length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowParsedPreview(false)
                    setParsedItems([])
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium text-xs sm:text-sm"
                >
                  Назад
                </button>
              </div>
            </div>
          ) : isBulkMode ? (
            <form onSubmit={handleParseBulkText}>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Список расходов *
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs sm:text-sm"
                  placeholder={'Например:\nДвигатель 5000 USD\nКоробка передач 2500 USD\nБампер 300\nФара 150 UAH'}
                  rows={8}
                  required
                />
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-xs text-gray-500">
                  Формат: название сумма валюта (каждый расход с новой строки). Валюта USD используется по умолчанию.
                </p>
              </div>
              <button
                type="submit"
                className="w-full mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors font-medium text-xs sm:text-sm"
              >
                Далее
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Сумма *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Валюта *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as CostCurrency })}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="UAH">UAH</option>
                  </select>
                </div>
              </div>

              {category === 'parts' && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Состояние *
                  </label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value as PartCondition })}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="new-original">{CONDITION_LABELS['new-original']}</option>
                    <option value="used-original">{CONDITION_LABELS['used-original']}</option>
                    <option value="aftermarket">{CONDITION_LABELS['aftermarket']}</option>
                  </select>
                </div>
              )}
              
              <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4">
                <div className="flex gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium text-xs sm:text-sm"
                  >
                    Отмена
                  </button><button
                    type="submit"
                    className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors font-medium text-xs sm:text-sm"
                  >
                    {editItem ? 'Сохранить' : 'Добавить'}
                  </button>
                  
                </div>
                {editItem && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors font-medium text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    Удалить
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Модалка подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-3 sm:p-4 md:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Удалить расход?</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">Это действие нельзя отменить.</p>
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteExpenseItem(vehicleId, category, editItem!.id)
                    onUpdate()
                    setShowDeleteConfirm(false)
                    onClose()
                  } catch (error) {
                    console.error('Failed to delete:', error)
                    showAlert('Ошибка при удалении расхода', 'error')
                    setShowDeleteConfirm(false)
                  }
                }}
                className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors font-medium text-xs sm:text-sm"
              >
                Удалить
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium text-xs sm:text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
