import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, FileText } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import InvoiceDocument from '@/components/invoices/InvoiceDocument'
import { getPublicInvoice } from '@/services/invoicesService'

export default function PublicInvoiceView() {
  const { token } = useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice', token],
    queryFn: () => getPublicInvoice(token!),
    enabled: !!token,
    retry: false,
  })

  if (isLoading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center"><Spinner size="lg" /></div>
  )

  if (isError || !data?.invoice) return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center mb-4"><FileText className="w-7 h-7 text-gray-400" /></div>
      <p className="font-semibold text-gray-700">Счёт не найден</p>
      <p className="text-sm text-gray-400 mt-1">Возможно, ссылка устарела или неверна</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-4">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end no-print">
        <button onClick={() => window.print()} className="btn-secondary btn-sm flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Печать
        </button>
      </div>
      <InvoiceDocument
        invoice={data.invoice}
        company={data.company}
        customer={data.customer}
        vehicle={data.vehicle}
      />
    </div>
  )
}
