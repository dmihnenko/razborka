import { useState } from 'react'
import { Plus, Search, Users } from 'lucide-react'

export default function PartsEmployees() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Сотрудники разборки</h1>
          <p className="text-gray-600 mt-2">Управление персоналом авторазборки</p>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2">
          <Plus size={20} />
          Добавить сотрудника
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Поиск по имени, email, телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="p-6">
          <div className="text-center text-gray-500 py-12">
            <Users className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-lg">Нет сотрудников</p>
            <p className="text-sm mt-2">Добавьте первого сотрудника для работы с разборкой</p>
          </div>
        </div>
      </div>
    </div>
  )
}
