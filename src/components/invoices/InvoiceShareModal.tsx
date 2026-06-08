import ShareModal from '@/components/ui/ShareModal'
import { fmtMoney } from '@/utils/money'

interface Props {
  isOpen: boolean
  onClose: () => void
  token: string
  number: string
  total: number
}

export default function InvoiceShareModal({ isOpen, onClose, token, number, total }: Props) {
  const url = `${window.location.origin}/public/invoice/${token}`
  return (
    <ShareModal
      isOpen={isOpen}
      onClose={onClose}
      url={url}
      title="Поделиться счётом"
      subtitle="Ссылка открывает счёт в браузере (можно распечатать)"
      shareTitle={`Счёт ${number}`}
      shareText={`Счёт ${number} на сумму ${fmtMoney(total)}`}
    />
  )
}
