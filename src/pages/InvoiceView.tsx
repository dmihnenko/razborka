import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Printer, Share2, Pencil, Trash2, CheckCircle2, RotateCcw } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import InvoiceDocument from '@/components/invoices/InvoiceDocument'
import InvoiceShareModal from '@/components/invoices/InvoiceShareModal'
import { getInvoice, deleteInvoice, setInvoiceStatus } from '@/services/invoicesService'

export default function InvoiceView() {
  const { invoiceId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { confirm, dialogProps } = useConfirm()
  const [shareOpen, setShareOpen] = useState(false)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: !!invoiceId,
  })

  const { data: company } = useQuery({
    queryKey: ['sto-company-doc', invoice?.sto_company_id],
    queryFn: async () => {
      const { data } = await supabase.from('sto_companies').select('name, phone, address, email').eq('id', invoice!.sto_company_id).single()
      return data
    },
    enabled: !!invoice?.sto_company_id,
  })

  // Статус связанной заявки — для подтверждения оплаты
  const { data: linkedAppt } = useQuery({
    queryKey: ['invoice-appt', invoice?.appointment_id],
    queryFn: async () => {
      const { data } = await supabase.from('appointments').select('status').eq('id', invoice!.appointment_id!).single()
      return data
    },
    enabled: !!invoice?.appointment_id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: 'issued' | 'paid') => setInvoiceStatus(invoiceId!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      // оплата счёта проставляет оплату по заявке
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['board-kanban'] })
      if (invoice?.appointment_id) qc.invalidateQueries({ queryKey: ['appointment', invoice.appointment_id] })
      toast.success('Статус обновлён')
    },
    onError: (e: any) => toast.error(e?.message || 'Ошибка'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoice(invoiceId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Счёт удалён'); navigate('/invoices') },
    onError: (e: any) => toast.error(e?.message || 'Ошибка'),
  })

  const handleDelete = async () => {
    const ok = await confirm({ message: 'Удалить счёт? Действие необратимо.', confirmText: 'Удалить', danger: true })
    if (ok) deleteMutation.mutate()
  }

  const APPT_STATUS_RU: Record<string, string> = {
    scheduled: 'Запланирована', in_progress: 'В работе', ready: 'Готова',
    completed: 'Завершена', archived: 'Архив', cancelled: 'Отменена',
  }
  const handleMarkPaid = async () => {
    if (!invoice) return
    let message = 'Отметить счёт оплаченным? Оплата работ и запчастей по заявке проставится автоматически.'
    if (invoice.appointment_id) {
      if (linkedAppt?.status === 'ready') {
        message = 'Счёт будет отмечен оплаченным. Заявка в статусе «Готова» — после оплаты она автоматически уйдёт в архив.'
      } else {
        const lbl = APPT_STATUS_RU[linkedAppt?.status ?? ''] ?? '—'
        message = `Счёт будет отмечен оплаченным. Сейчас заявка в статусе «${lbl}». Чтобы после оплаты она ушла в архив, мастер или владелец должен сменить статус заявки на «Готова».`
      }
    }
    const ok = await confirm({ message, confirmText: 'Оплачен' })
    if (ok) statusMutation.mutate('paid')
  }
  const handleRevertIssued = async () => {
    const ok = await confirm({
      message: 'Вернуть счёт в статус «Выставлен» и отменить оплату? Оплата работ и запчастей по заявке будет снята, а если заявка в архиве — вернётся в «Готова».',
      confirmText: 'Отменить оплату',
    })
    if (ok) statusMutation.mutate('issued')
  }

  if (isLoading || !invoice) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Spinner size="lg" /></div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Панель действий (не печатается) */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm no-print">
        <div className="w-full px-3 sm:px-6 h-14 flex items-center gap-2">
          <button onClick={() => navigate('/invoices')} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 text-base flex-1 truncate">Счёт {invoice.invoice_number}</h1>

          {invoice.status !== 'paid' ? (
            <button onClick={handleMarkPaid} className="btn-success btn-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> <span className="hidden sm:inline">Оплачен</span>
            </button>
          ) : (
            <button onClick={handleRevertIssued} className="btn-secondary btn-sm flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Отменить оплату</span>
            </button>
          )}
          <button onClick={() => setShareOpen(true)} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Поделиться</span>
          </button>
          <button onClick={() => window.print()} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Печать</span>
          </button>
          <button onClick={() => navigate(`/sto/invoices/${invoice.id}/edit`)} className="btn-icon" title="Изменить"><Pencil className="w-4 h-4" /></button>
          <button onClick={handleDelete} className="btn-icon text-red-500 hover:bg-red-50" title="Удалить"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 py-6">
        <InvoiceDocument invoice={invoice} company={company} customer={invoice.customers} vehicle={invoice.vehicles} />
      </div>

      {shareOpen && (
        <InvoiceShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          token={invoice.public_token}
          number={invoice.invoice_number || ''}
          total={invoice.total}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
