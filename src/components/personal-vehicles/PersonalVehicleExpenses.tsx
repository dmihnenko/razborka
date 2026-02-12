import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import ExpenseCategory from './ExpenseCategory'
import ExpenseModal from './ExpenseModal'
import type { PersonalVehicle, PersonalCostItem, CostCategory } from '@/types/personalVehicles'
import { addExpenseItem, updateExpenseItem, deleteExpenseItem } from '@/services/personalVehicles'
import { useAlert } from '../CustomAlert'

interface Props {
  vehicleId: string
  vehicle: PersonalVehicle
  isOwner: boolean
  onUpdate: () => void
}

export default function PersonalVehicleExpenses({ vehicleId, vehicle, isOwner, onUpdate }: Props) {
  const { showAlert } = useAlert()
  const [showRateModal, setShowRateModal] = useState(false)
  const [rateInput, setRateInput] = useState(vehicle.usdRate?.toString() || '')
  const [activeCategory, setActiveCategory] = useState<CostCategory | null>(null)
  const [editingItem, setEditingItem] = useState<PersonalCostItem | undefined>()
  const [loading, setLoading] = useState(false)

  const handleSetRate = async (e: React.FormEvent) => {
    e.preventDefault()
    const rate = parseFloat(rateInput)
    if (isNaN(rate) || rate <= 0) {
      showAlert('Введите корректный курс', 'error')
      return
    }

    setLoading(true)
    try {
      const { updatePersonalVehicle } = await import('@/services/personalVehicles')
      await updatePersonalVehicle(vehicleId, { usdRate: rate })
      onUpdate()
      setShowRateModal(false)
    } catch (error) {
      console.error('Failed to update USD rate:', error)
      showAlert('Ошибка при обновлении курса', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveExpense = async (item: PersonalCostItem) => {
    if (!activeCategory) return

    setLoading(true)
    try {
      if (editingItem) {
        await updateExpenseItem(vehicleId, activeCategory, item.id, item)
      } else {
        await addExpenseItem(vehicleId, activeCategory, item)
      }
      onUpdate()
      setActiveCategory(null)
      setEditingItem(undefined)
    } catch (error) {
      console.error('Failed to save expense:', error)
      showAlert('Ошибка при сохранении расхода', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBulkExpenses = async (items: PersonalCostItem[]) => {
    if (!activeCategory) return

    setLoading(true)
    try {
      // Добавляем все расходы последовательно
      for (const item of items) {
        await addExpenseItem(vehicleId, activeCategory, item)
      }
      onUpdate()
      setActiveCategory(null)
    } catch (error) {
      console.error('Failed to save bulk expenses:', error)
      showAlert('Ошибка при массовом добавлении расходов', 'error')
    } finally {
      setLoading(false)
    }
  }

  const calculateGrandTotal = () => {
    const usdRate = vehicle.usdRate || 1
    const allItems = [
      ...vehicle.lotItems,
      ...vehicle.partsItems,
      ...vehicle.workItems,
      ...vehicle.additionalItems
    ]

    const totalUSD = allItems
      .filter(i => i.currency === 'USD')
      .reduce((s, i) => s + i.cost, 0)

    const totalUAH = allItems
      .filter(i => i.currency === 'UAH')
      .reduce((s, i) => s + i.cost, 0)

    const grandTotal = totalUSD + (totalUAH / usdRate)

    return { totalUSD, totalUAH, grandTotal }
  }

  const { totalUSD, totalUAH, grandTotal } = calculateGrandTotal()

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Расходы</h3>
      </div>

      {!vehicle.usdRate && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ Курс USD не установлен. Установите курс для корректного расчета расходов в гривнах.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        <ExpenseCategory
          category="lot"
          items={vehicle.lotItems}
          usdRate={vehicle.usdRate || 1}
          onAdd={() => { setActiveCategory('lot'); setEditingItem(undefined); }}
          onEdit={(item) => { setActiveCategory('lot'); setEditingItem(item); }}
          onDelete={(id) => handleDeleteExpense('lot', id)}
          isOwner={isOwner}
        />

        <ExpenseCategory
          category="parts"
          items={vehicle.partsItems}
          usdRate={vehicle.usdRate || 1}
          onAdd={() => { setActiveCategory('parts'); setEditingItem(undefined); }}
          onEdit={(item) => { setActiveCategory('parts'); setEditingItem(item); }}
          onDelete={(id) => handleDeleteExpense('parts', id)}
          isOwner={isOwner}
        />

        <ExpenseCategory
          category="work"
          items={vehicle.workItems}
          usdRate={vehicle.usdRate || 1}
          onAdd={() => { setActiveCategory('work'); setEditingItem(undefined); }}
          onEdit={(item) => { setActiveCategory('work'); setEditingItem(item); }}
          onDelete={(id) => handleDeleteExpense('work', id)}
          isOwner={isOwner}
        />

        <ExpenseCategory
          category="additional"
          items={vehicle.additionalItems}
          usdRate={vehicle.usdRate || 1}
          onAdd={() => { setActiveCategory('additional'); setEditingItem(undefined); }}
          onEdit={(item) => { setActiveCategory('additional'); setEditingItem(item); }}
          onDelete={(id) => handleDeleteExpense('additional', id)}
          isOwner={isOwner}
        />
      </div>

      {/* Модалка редактирования расхода */}
      {activeCategory && (
        <ExpenseModal
          isOpen={true}
          onClose={() => {
            setActiveCategory(null)
            setEditingItem(undefined)
          }}
          category={activeCategory}
          editItem={editingItem}
          onSave={handleSaveExpense}
          onSaveBulk={handleSaveBulkExpenses}
          vehicleId={vehicleId}
          onUpdate={onUpdate}
        />
      )}

      {/* Модалка установки курса */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Установить курс USD</h3>
            <form onSubmit={handleSetRate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Курс USD (1 USD = ? UAH)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="40.50"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка расхода */}
      {activeCategory && (
        <ExpenseModal
          isOpen={true}
          onClose={() => { setActiveCategory(null); setEditingItem(undefined); }}
          category={activeCategory}
          editItem={editingItem}
          onSave={handleSaveExpense}
          onSaveBulk={handleSaveBulkExpenses}
          vehicleId={vehicleId}
          onUpdate={onUpdate}
        />
      )}
    </div>
  )
}
