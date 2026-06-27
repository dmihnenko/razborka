import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import MyOrdersPanel from '@/components/orders/MyOrdersPanel'

export default function MyOrders() {
  const { t } = useTranslation('cabinet')

  return (
    <div className="py-1 sm:py-2">
      <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
        {/* Шапка */}
        <header className="card p-5 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="icon-tile-lg bg-blue-50 text-blue-600 shrink-0">
              <Package className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="page-title">{t('myOrdersPage.title')}</h1>
              <p className="page-subtitle">{t('myOrdersPage.subtitle')}</p>
            </div>
          </div>
        </header>

        <MyOrdersPanel />
      </div>
    </div>
  )
}
