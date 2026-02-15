import { BarChart3, TrendingUp, DollarSign, Package } from 'lucide-react'

export default function PartsAnalytics() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Аналитика разборки</h1>
        <p className="text-gray-600 mt-2">Статистика и отчёты по работе авторазборки</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <DollarSign className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Выручка за месяц</p>
              <p className="text-2xl font-bold">₴0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Прибыль</p>
              <p className="text-2xl font-bold">₴0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <Package className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Продано запчастей</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-full">
              <BarChart3 className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Средний чек</p>
              <p className="text-2xl font-bold">₴0</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Продажи по месяцам</h2>
          <div className="text-center text-gray-500 py-12">
            <BarChart3 className="mx-auto mb-4 text-gray-400" size={48} />
            <p>Нет данных для отображения</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Популярные категории</h2>
          <div className="text-center text-gray-500 py-12">
            <Package className="mx-auto mb-4 text-gray-400" size={48} />
            <p>Нет данных для отображения</p>
          </div>
        </div>
      </div>
    </div>
  )
}
