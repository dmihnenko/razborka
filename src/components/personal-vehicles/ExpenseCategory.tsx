import { Plus } from 'lucide-react'
import type { PersonalCostItem, CostCategory } from '@/types/personalVehicles'
import { CATEGORY_LABELS, CONDITION_LABELS } from '@/types/personalVehicles'

interface Props {
  category: CostCategory
  items: PersonalCostItem[]
  usdRate: number
  onAdd: () => void
  onEdit: (item: PersonalCostItem) => void
  onDelete: (itemId: string) => void
  isOwner: boolean
}

export default function ExpenseCategory({
  category,
  items,
  usdRate,
  onAdd,
  onEdit,
  isOwner
}: Props) {
  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const usdValue = item.currency === 'USD' ? item.cost : item.cost / (usdRate || 1)
      return sum + usdValue
    }, 0)
  }

  const total = calculateTotal()

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 flex items-center justify-between">
        <h4 className="font-semibold text-sm sm:text-base text-gray-900">{CATEGORY_LABELS[category]}</h4>
        {isOwner && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-blue-600 text-white text-xs sm:text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            Добавить
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-4">
          <p className="text-gray-500 text-sm text-center py-4">Нет расходов</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-700">Название</th>
                  {category === 'parts' && (
                    <th className="hidden sm:table-cell text-left px-4 py-3 text-sm font-semibold text-gray-700">Состояние</th>
                  )}
                  <th className="text-right px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-700">Сумма</th>
                  <th className="text-right px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-700">USD</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => isOwner && onEdit(item)}
                    className={`border-b border-gray-100 transition-colors ${
                      isOwner ? 'cursor-pointer hover:bg-gray-50' : ''
                    }`}
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">{item.name}</td>
                    {category === 'parts' && (
                      <td className="hidden sm:table-cell px-4 py-3">
                        {item.condition && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded whitespace-nowrap">
                            {CONDITION_LABELS[item.condition]}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-medium text-xs sm:text-sm text-gray-900 whitespace-nowrap">
                      {item.cost.toLocaleString()} {item.currency}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                      ${item.currency === 'USD' ? item.cost.toFixed(2) : (item.cost / (usdRate || 1)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td colSpan={2} className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-xs sm:text-sm text-gray-700">
                    Итого:
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-blue-600 text-sm sm:text-base md:text-lg">
                    ${total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
