import ReassignWorkerModalBase from '@/components/ReassignWorkerModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  workOrderId: string
  currentWorkerId: string | null
  workOrderInfo: {
    customerName: string
    vehicleName: string
  }
}

export default function ReassignWorkerModal({
  workOrderId,
  workOrderInfo,
  ...rest
}: Props) {
  return (
    <ReassignWorkerModalBase
      {...rest}
      entityId={workOrderId}
      entityTable="work_orders"
      entityLabel="Заказ-наряд:"
      entityInfo={workOrderInfo}
      invalidateQueryKeys={['work_orders', 'worker_appointments']}
    />
  )
}

