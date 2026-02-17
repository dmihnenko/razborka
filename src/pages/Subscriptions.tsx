import { useState } from 'react'
import { CreditCard, TrendingUp, Plus, Trash2, Calendar, Building2, CheckCircle, XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  getSubscriptionPlans, 
  getAllCompanySubscriptions, 
  getSubscriptionStats,
  deactivateSubscription,
  deleteCompanySubscription,
  assignSubscription,
  getStoCompanies,
  getPartsCompanies
} from '@/services/subscriptionService'
import type { CompanySubscription } from '@/types/subscription'

export default function Subscriptions() {
  const [activeTab, setActiveTab] = useState<'plans' | 'active'>('plans')
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({
    companyType: 'sto' as 'sto' | 'parts',
    companyId: '',
    subscriptionId: '',
    endDate: ''
  })
  const queryClient = useQueryClient()

  // Fetch data
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: getSubscriptionPlans
  })

  const { data: companySubscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['company-subscriptions'],
    queryFn: getAllCompanySubscriptions
  })

  const { data: stats } = useQuery({
    queryKey: ['subscription-stats'],
    queryFn: getSubscriptionStats
  })

  // Fetch companies
  const { data: stoCompanies = [] } = useQuery({
    queryKey: ['sto-companies-list'],
    queryFn: getStoCompanies,
    enabled: assignForm.companyType === 'sto'
  })

  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts-companies-list'],
    queryFn: getPartsCompanies,
    enabled: assignForm.companyType === 'parts'
  })

  // Assign subscription mutation
  const assignMutation = useMutation({
    mutationFn: assignSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
      toast.success('Подписка назначена')
      setIsAssignModalOpen(false)
      setAssignForm({ companyType: 'sto', companyId: '', subscriptionId: '', endDate: '' })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при назначении подписки')
    }
  })

  // Deactivate subscription
  const deactivateMutation = useMutation({
    mutationFn: deactivateSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
      toast.success('Подписка деактивирована')
    },
    onError: () => {
      toast.error('Ошибка при деактивации')
    }
  })

  // Delete subscription
  const deleteMutation = useMutation({
    mutationFn: deleteCompanySubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
      toast.success('Подписка удалена')
    },
    onError: () => {
      toast.error('Ошибка при удалении')
    }
  })

  const handleDeactivate = (subscription: CompanySubscription) => {
    if (confirm(`Деактивировать подписку для ${subscription.company?.name}?`)) {
      deactivateMutation.mutate(subscription.id)
    }
  }

  const handleDelete = (subscription: CompanySubscription) => {
    if (confirm(`Удалить подписку для ${subscription.company?.name}?`)) {
      deleteMutation.mutate(subscription.id)
    }
  }

  const isExpired = (subscription: CompanySubscription) => {
    if (!subscription.end_date) return false
    return new Date(subscription.end_date) < new Date()
  }

  const handleAssignSubmit = () => {
    if (!assignForm.companyId || !assignForm.subscriptionId) {
      toast.error('Выберите компанию и план подписки')
      return
    }

    const selectedPlan = plans.find(p => p.id === assignForm.subscriptionId)
    if (selectedPlan?.type === 'monthly' && !assignForm.endDate) {
      toast.error('Укажите дату окончания для месячной подписки')
      return
    }

    assignMutation.mutate({
      company_id: assignForm.companyId,
      company_type: assignForm.companyType,
      subscription_id: assignForm.subscriptionId,
      end_date: assignForm.endDate || undefined
    })
  }

  const selectedPlan = plans.find(p => p.id === assignForm.subscriptionId)
  const companies = assignForm.companyType === 'sto' ? stoCompanies : partsCompanies
  const filteredPlans = plans.filter(p => p.company_type === assignForm.companyType)
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Подписки</h1>
        <p className="text-sm text-gray-600 mt-1">Управление подписками СТО и разборок</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Активные подписки */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{stats?.total_active || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900">Активные</h3>
          <p className="text-sm text-gray-600 mt-1">Действующие подписки</p>
        </div>

        {/* Месячные */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{stats?.total_monthly || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900">Месячные</h3>
          <p className="text-sm text-gray-600 mt-1">Временные подписки</p>
        </div>

        {/* Бессрочные */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{stats?.total_lifetime || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900">Бессрочные</h3>
          <p className="text-sm text-gray-600 mt-1">Lifetime подписки</p>
        </div>

        {/* Доход за месяц */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">₴{stats?.revenue_this_month.toFixed(0) || 0}</span>
          </div>
          <h3 className="font-semibold text-gray-900">Доход за месяц</h3>
          <p className="text-sm text-gray-600 mt-1">Новые подписки</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('plans')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plans'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Планы подписок
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'active'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Активные подписки ({companySubscriptions.filter(s => s.is_active).length})
          </button>
        </nav>
      </div>

      {/* Планы подписок */}
      {activeTab === 'plans' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Доступные планы</h2>
          </div>
          
          {plansLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => (
                <div key={plan.id} className="border-2 border-gray-200 rounded-lg p-6 hover:border-primary transition">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">₴{plan.price}</span>
                      {plan.type === 'monthly' && <span className="text-gray-600">/мес</span>}
                      {plan.type === 'lifetime' && <span className="text-sm text-green-600 font-medium">навсегда</span>}
                    </div>
                  </div>
                  
                  {plan.description && (
                    <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                  )}
                  
                  <div className="mt-auto">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      plan.type === 'monthly' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {plan.type === 'monthly' ? 'Месячная' : 'Бессрочная'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Активные подписки */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Активные подписки компаний</h2>
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Plus size={20} />
              Назначить подписку
            </button>
          </div>
          
          <div className="p-6">
            {subsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : companySubscriptions.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <CreditCard className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-lg">Нет подписок</p>
              </div>
            ) : (
              <div className="space-y-4">
                {companySubscriptions.map((subscription) => (
                  <div key={subscription.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building2 size={20} className="text-gray-500" />
                          <h3 className="text-lg font-semibold">{subscription.company?.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            subscription.company_type === 'sto' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {subscription.company_type === 'sto' ? 'СТО' : 'Разборка'}
                          </span>
                          {subscription.is_active ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Активна
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Неактивна
                            </span>
                          )}
                          {isExpired(subscription) && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Истекла
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">План:</span> {subscription.subscription?.name}
                          </div>
                          <div>
                            <span className="font-medium">Цена:</span> ₴{subscription.subscription?.price}
                          </div>
                          <div>
                            <span className="font-medium">Начало:</span> {new Date(subscription.start_date).toLocaleDateString('ru-RU')}
                          </div>
                          <div>
                            <span className="font-medium">Окончание:</span> {
                              subscription.end_date 
                                ? new Date(subscription.end_date).toLocaleDateString('ru-RU')
                                : 'Бессрочно'
                            }
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        {subscription.is_active && (
                          <button
                            onClick={() => handleDeactivate(subscription)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                            title="Деактивировать"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDelete(subscription)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Удалить"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно назначения подписки */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Назначить подписку</h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Тип компании */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип компании *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="companyType"
                      value="sto"
                      checked={assignForm.companyType === 'sto'}
                      onChange={(e) => setAssignForm({ ...assignForm, companyType: e.target.value as 'sto', companyId: '', subscriptionId: '' })}
                      className="mr-2"
                    />
                    СТО
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="companyType"
                      value="parts"
                      checked={assignForm.companyType === 'parts'}
                      onChange={(e) => setAssignForm({ ...assignForm, companyType: e.target.value as 'parts', companyId: '', subscriptionId: '' })}
                      className="mr-2"
                    />
                    Разборка
                  </label>
                </div>
              </div>

              {/* Выбор компании */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Компания *
                </label>
                <select
                  value={assignForm.companyId}
                  onChange={(e) => setAssignForm({ ...assignForm, companyId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Выберите компанию</option>
                  {companies.map((company: any) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* План подписки */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  План подписки *
                </label>
                <select
                  value={assignForm.subscriptionId}
                  onChange={(e) => setAssignForm({ ...assignForm, subscriptionId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Выберите план</option>
                  {filteredPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ₴{plan.price} ({plan.type === 'monthly' ? 'месячная' : 'бессрочная'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Дата окончания (только для месячных) */}
              {selectedPlan?.type === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дата окончания *
                  </label>
                  <input
                    type="date"
                    value={assignForm.endDate}
                    onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAssignModalOpen(false)
                  setAssignForm({ companyType: 'sto', companyId: '', subscriptionId: '', endDate: '' })
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={assignMutation.isPending}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {assignMutation.isPending ? 'Назначение...' : 'Назначить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
