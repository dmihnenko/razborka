import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { SaleSheet } from '@/components/parts/sale/SaleSheet'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'

/**
 * «+ Продажа»: страница-обёртка над единой формой продажи (SaleSheet, режим manual).
 * Позиции добавляются сразу в форме; по завершении открывается карточка заказа.
 */
export default function PartsCreateOrder() {
  const navigate = useNavigate()
  const doneRef = useRef(false)
  const { data: profile } = useUserProfile()

  if (!profile?.parts_company_id) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader title={i18n.t('cabinet:pages.createOrder')} backPath="/parts/orders" maxWidth="3xl" />
      <SaleSheet
        open
        source="manual"
        onClose={() => { if (!doneRef.current) navigate('/parts/sales?tab=orders', { replace: true }) }}
        onDone={(orderId) => { doneRef.current = true; navigate(`/parts/orders/${orderId}`, { replace: true }) }}
      />
    </div>
  )
}
