import { Zap, CheckCircle2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { getSubscriptionTiers } from '@/services/subscriptionService'

interface Props {
  isOpen: boolean
  onClose: () => void
  context: 'appointments' | 'customers'
  currentPlan?: string
  used: number
  limit: number
}

export default function SubscriptionUpgradeModal({ isOpen, onClose, context, currentPlan, used, limit }: Props) {
  const navigate = useNavigate()
  const label = context === 'appointments' ? 'заявок' : 'клиентов'

  const { data: tiers = [] } = useQuery({
    queryKey: ['subscription-tiers', 'sto'],
    queryFn: () => getSubscriptionTiers('sto'),
    enabled: isOpen,
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon={<div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0"><Lock className="w-5 h-5 text-amber-600" /></div>}
      title="Достигнут лимит"
      subtitle={`Лимит тарифа «${currentPlan || 'Пробный'}»: ${used}/${limit} ${label}`}
      footer={
        <div className="space-y-2">
          <button
            onClick={() => { navigate('/sto/subscription'); onClose() }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Посмотреть все тарифы и обновить
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      }
    >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-1">
            Обновите тариф, чтобы продолжить работу без ограничений:
          </p>

          {tiers.map((p) => {
            const limitValue = context === 'appointments' ? p.max_appointments : p.max_customers
            return (
              <div
                key={p.id}
                className="relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer hover:border-primary/40 border-gray-100 bg-gray-50"
                onClick={() => { navigate('/sto/subscription'); onClose() }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-gray-900">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                    {p.is_custom
                      ? 'Индивидуальные условия'
                      : limitValue == null
                        ? `Безлимит ${label}`
                        : `До ${limitValue} ${label}`}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {p.is_custom
                    ? <p className="font-bold text-gray-900 text-sm">Индивидуально</p>
                    : <><p className="font-bold text-gray-900">₴{p.price.toLocaleString()}</p><p className="text-xs text-gray-400">в месяц</p></>}
                </div>
              </div>
            )
          })}
        </div>
    </Modal>
  )
}
