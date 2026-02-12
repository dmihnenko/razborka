import { CreditCard, FileText, TrendingUp } from 'lucide-react';

export default function Subscriptions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Подписки</h1>
        <p className="text-sm text-gray-600 mt-1">Управление подписками СТО и разборок</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Активные подписки */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="font-semibold text-gray-900">Активные подписки</h3>
          <p className="text-sm text-gray-600 mt-1">Действующие подписки</p>
        </div>

        {/* Ожидают оплаты */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <FileText className="h-6 w-6 text-yellow-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">0</span>
          </div>
          <h3 className="font-semibold text-gray-900">Ожидают оплаты</h3>
          <p className="text-sm text-gray-600 mt-1">Неоплаченные счета</p>
        </div>

        {/* Доход за месяц */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">₴0</span>
          </div>
          <h3 className="font-semibold text-gray-900">Доход за месяц</h3>
          <p className="text-sm text-gray-600 mt-1">Выручка текущего месяца</p>
        </div>
      </div>

      {/* Планы подписок */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Планы подписок</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Базовый */}
          <div className="border-2 border-gray-200 rounded-lg p-6 hover:border-purple-500 transition">
            <h3 className="text-lg font-semibold mb-2">Базовый</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold">₴500</span>
              <span className="text-gray-600">/месяц</span>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 mb-6">
              <li>✓ До 100 заявок в месяц</li>
              <li>✓ 1 пользователь</li>
              <li>✓ Базовая поддержка</li>
              <li>✓ Мобильное приложение</li>
            </ul>
            <button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
              В разработке
            </button>
          </div>

          {/* Стандарт */}
          <div className="border-2 border-purple-500 rounded-lg p-6 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              Популярный
            </div>
            <h3 className="text-lg font-semibold mb-2">Стандарт</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold">₴1200</span>
              <span className="text-gray-600">/месяц</span>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 mb-6">
              <li>✓ До 500 заявок в месяц</li>
              <li>✓ До 5 пользователей</li>
              <li>✓ Приоритетная поддержка</li>
              <li>✓ Мобильное приложение</li>
              <li>✓ Аналитика и отчеты</li>
            </ul>
            <button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
              В разработке
            </button>
          </div>

          {/* Премиум */}
          <div className="border-2 border-gray-200 rounded-lg p-6 hover:border-purple-500 transition">
            <h3 className="text-lg font-semibold mb-2">Премиум</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold">₴2500</span>
              <span className="text-gray-600">/месяц</span>
            </div>
            <ul className="space-y-2 text-sm text-gray-600 mb-6">
              <li>✓ Неограниченные заявки</li>
              <li>✓ Неограниченные пользователи</li>
              <li>✓ VIP поддержка 24/7</li>
              <li>✓ Мобильное приложение</li>
              <li>✓ Расширенная аналитика</li>
              <li>✓ API доступ</li>
            </ul>
            <button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
              В разработке
            </button>
          </div>
        </div>
      </div>

      {/* Информационное сообщение */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Функционал в разработке</h3>
            <p className="mt-1 text-sm text-blue-700">
              Система подписок будет реализована в следующих обновлениях. Подписка владельца СТО или разборки
              автоматически распространяется на всех его работников.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
