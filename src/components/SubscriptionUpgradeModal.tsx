import { Zap, CheckCircle2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/ui/Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
  context: 'appointments' | 'customers'
  currentPlan?: string
  used: number
  limit: number
}

const UPGRADE_PLANS = [
  {
    name: 'Старт',
    subtitle: '1 месяц',
    price: 499,
    maxAppointments: 50,
    maxCustomers: 100,
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    name: 'Бизнес',
    subtitle: '6 месяцев',
    price: 2499,
    maxAppointments: 200,
    maxCustomers: 500,
    color: '#7C3AED',
    bg: '#F5F3FF',
    badge: 'Популярный',
  },
  {
    name: 'Профи',
    subtitle: '12 месяцев',
    price: 4499,
    maxAppointments: null,
    maxCustomers: null,
    color: '#059669',
    bg: '#F0FDF4',
  },
  {
    name: 'Навсегда',
    subtitle: 'Бессрочно',
    price: 9999,
    maxAppointments: null,
    maxCustomers: null,
    color: '#D97706',
    bg: '#FFFBEB',
    badge: 'Выгодно',
  },
]

export default function SubscriptionUpgradeModal({ isOpen, onClose, context, currentPlan, used, limit }: Props) {
  const navigate = useNavigate()
  const label = context === 'appointments' ? 'заявок' : 'клиентов'

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

          {UPGRADE_PLANS.map((p) => {
            const limitValue = context === 'appointments' ? p.maxAppointments : p.maxCustomers
            return (
              <div
                key={p.name}
                className="relative flex items-center gap-4 p-4 rounded-xl border-2 border-transparent transition-all cursor-pointer hover:border-opacity-50"
                style={{ backgroundColor: p.bg, borderColor: p.color + '30' }}
              >
                {p.badge && (
                  <span
                    className="absolute -top-2 right-3 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.badge}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-gray-900">{p.name}</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs text-gray-500">{p.subtitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: p.color }} />
                    {limitValue === null
                      ? `Безлимит ${label}`
                      : `До ${limitValue} ${label}`
                    }
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">₴{p.price.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{p.subtitle}</p>
                </div>
              </div>
            )
          })}
        </div>
    </Modal>
  )
}
