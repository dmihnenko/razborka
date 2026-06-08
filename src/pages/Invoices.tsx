import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Search, X, FileText, Share2, Pencil, Trash2, User, Car } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import InvoiceShareModal from '@/components/invoices/InvoiceShareModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getInvoices, deleteInvoice } from '@/services/invoicesService'
import { fmtMoney } from '@/utils/money'
import type { Invoice } from '@/types/invoice'

const STATUS = {
  draft:  { label: 'Черновик',  cls: 'bg-gray-100 text-gray-600' },
  issued: { label: 'Выставлен', cls: 'bg-blue-100 text-blue-700' },
  paid:   { label: 'Оплачен',   cls: 'bg-green-100 text-green-700' },
}

export default function Invoices() {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { confirm, dialogProps } = useConfirm()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'issued' | 'paid' | 'draft'>('all')
  const [shareInv, setShareInv] = useState<Invoice | null>(null)

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', profile?.sto_company_id],
    queryFn: () => getInvoices(profile!.sto_company_id!),
    enabled: !!profile?.sto_company_id,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Счёт удалён') },
    onError: (e: any) => toast.error(e?.message || 'Ошибка'),
  })

  const filtered = useMemo(() => {
    let list = invoices as Invoice[]
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(i =>
      i.invoice_number?.toLowerCase().includes(q) ||
      i.customers?.name?.toLowerCase().includes(q) ||
      `${i.vehicles?.brand ?? ''} ${i.vehicles?.model ?? ''}`.toLowerCase().includes(q)
    )
    return list
  }, [invoices, search, statusFilter])

  const handleDelete = async (id: string) => {
    const ok = await confirm({ message: 'Удалить счёт? Действие необратимо.', confirmText: 'Удалить', danger: true })
    if (ok) deleteMutation.mutate(id)
  }

  return (
    <div className="container-mobile">
      <PageHeader
        title="Счета"
        subtitle="Счета клиентов: формирование, печать, отправка"
        actions={
          <button onClick={() => navigate('/invoices/new')} className="btn-primary btn-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Новый счёт</span><span className="sm:hidden">Счёт</span>
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск: №, клиент, авто…" className="form-input pl-9 pr-8" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="form-select sm:w-44">
          <option value="all">Все статусы</option>
          <option value="issued">Выставленные</option>
          <option value="paid">Оплаченные</option>
          <option value="draft">Черновики</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || statusFilter !== 'all' ? 'Ничего не найдено' : 'Счетов пока нет'}
          description={search || statusFilter !== 'all' ? 'Измените запрос или фильтр' : 'Сформируйте первый счёт по заявке клиента'}
          action={!search && statusFilter === 'all' && (
            <button onClick={() => navigate('/invoices/new')} className="btn-primary btn-sm inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Новый счёт</button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(inv => {
            const st = STATUS[inv.status] ?? STATUS.issued
            return (
              <div key={inv.id} className="card p-0 overflow-hidden hover:border-primary/30 hover:shadow-md transition-all flex flex-col">
                <button onClick={() => navigate(`/sto/invoices/${inv.id}`)} className="text-left p-4 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-gray-900">{inv.invoice_number}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                    <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{inv.customers?.name || '—'}</span>
                  </div>
                  {inv.vehicles && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{inv.vehicles.brand} {inv.vehicles.model}</span>
                    </div>
                  )}
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString('ru-RU')}</span>
                    <span className="text-lg font-bold text-gray-900 tabular-nums">{fmtMoney(inv.total)}</span>
                  </div>
                </button>
                <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-1">
                  <button onClick={() => setShareInv(inv)} className="btn-icon-sm" title="Поделиться"><Share2 className="w-4 h-4" /></button>
                  <button onClick={() => navigate(`/sto/invoices/${inv.id}/edit`)} className="btn-icon-sm" title="Изменить"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(inv.id)} className="btn-icon-sm text-red-400 hover:text-red-600" title="Удалить"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {shareInv && (
        <InvoiceShareModal
          isOpen={!!shareInv}
          onClose={() => setShareInv(null)}
          token={shareInv.public_token}
          number={shareInv.invoice_number || ''}
          total={shareInv.total}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
