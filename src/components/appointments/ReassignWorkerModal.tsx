import ReassignWorkerModalBase from '@/components/ReassignWorkerModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointmentId: string
  currentWorkerId: string | null
  appointmentInfo: {
    customerName: string
    vehicleName: string
  }
}

export default function ReassignWorkerModal({
  appointmentId,
  appointmentInfo,
  ...rest
}: Props) {
  return (
    <ReassignWorkerModalBase
      {...rest}
      entityId={appointmentId}
      entityTable="appointments"
      entityLabel="Заявка:"
      entityInfo={appointmentInfo}
      filterIsActive
      invalidateQueryKeys={['appointments', 'worker_appointments']}
    />
  )
}
