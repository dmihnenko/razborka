import { useState } from 'react'
import { Plus, Search, ShoppingCart } from 'lucide-react'

export default function PartsOrders() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Заказы</h1>
          <p className="text-gray-600 mt-2">Управление заказами запчастей</p>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2">
          <Plus size={20} />
          Создать заказ
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-full">
              <ShoppingCart className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Новые</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <ShoppingCart className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">В обработке</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <ShoppingCart className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Завершено</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <ShoppingCart className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Сумма за месяц</p>
              <p className="text-2xl font-bold">₴0</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Поиск по номеру заказа, клиенту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">Все статусы</option>
              <option value="pending">Новый</option>
              <option value="processing">В обработке</option>
              <option value="ready">Готов к выдаче</option>
              <option value="completed">Завершён</option>
              <option value="cancelled">Отменён</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center text-gray-500 py-12">
            <ShoppingCart className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-lg">Нет заказов</p>
            <p className="text-sm mt-2">Создайте первый заказ для клиента</p>
          </div>
        </div>
      </div>
    </div>
  )
}
