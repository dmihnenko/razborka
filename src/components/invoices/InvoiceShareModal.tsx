import { Copy, Share2, Send, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { fmtMoney } from '@/utils/money'

interface Props {
  isOpen: boolean
  onClose: () => void
  token: string
  number: string
  total: number
}

export default function InvoiceShareModal({ isOpen, onClose, token, number, total }: Props) {
  const link = `${window.location.origin}/public/invoice/${token}`
  const text = `Счёт ${number} на сумму ${fmtMoney(total)}: ${link}`

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Ссылка скопирована') }
    catch { toast.error('Не удалось скопировать') }
  }
  const systemShare = async () => {
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: `Счёт ${number}`, text: `Счёт ${number} на сумму ${fmtMoney(total)}`, url: link }) } catch { /* отменено */ }
    } else {
      copy()
    }
  }

  const messengers = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(text)}`,  cls: 'bg-green-50 text-green-700 hover:bg-green-100',   Icon: MessageCircle },
    { label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Счёт ' + number)}`, cls: 'bg-blue-50 text-blue-700 hover:bg-blue-100', Icon: Send },
    { label: 'Viber',    href: `viber://forward?text=${encodeURIComponent(text)}`,  cls: 'bg-purple-50 text-purple-700 hover:bg-purple-100', Icon: MessageCircle },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      icon={<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Share2 className="w-5 h-5 text-primary" /></div>}
      title="Поделиться счётом"
      subtitle="Ссылка открывает счёт в браузере (можно распечатать)"
    >
      <div className="space-y-4">
        {/* Ссылка */}
        <div className="flex items-center gap-2">
          <input readOnly value={link} className="form-input text-xs flex-1" onFocus={e => e.target.select()} />
          <button onClick={copy} className="btn-secondary btn-sm flex-shrink-0 flex items-center gap-1.5"><Copy className="w-4 h-4" /> Копировать</button>
        </div>

        {/* Мессенджеры */}
        <div className="grid grid-cols-3 gap-2">
          {messengers.map(({ label, href, cls, Icon }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-colors ${cls}`}>
              <Icon className="w-5 h-5" /> {label}
            </a>
          ))}
        </div>

        {/* Системное «Поделиться» */}
        <button onClick={systemShare} className="btn-primary w-full flex items-center justify-center gap-2">
          <Share2 className="w-4 h-4" /> Поделиться…
        </button>
      </div>
    </Modal>
  )
}
