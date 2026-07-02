import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'
import { QueryState } from '@/components/ui/QueryState'
import { Plus, Search, Users, Phone, TrendingUp, DollarSign, Link2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { getPartsCustomers, createPartsCustomer, updatePartsCustomer, deletePartsCustomer, getPartsCustomer } from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'

import { formatCurrency } from '@/utils/currency'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import PartsCustomerModal from '@/components/parts/PartsCustomerModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { PartsCustomer, CreatePartsCustomerInput } from '@/types/parts'

/** Инициалы для аватара */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/** Единый аватар (ink/индиго) — без радуги */
function avatarColor(_name: string): string {
  return 'bg-[var(--cab-surface-2)] text-[var(--cab-ink-2)]'
}

export default function PartsCustomers() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<PartsCustomer | null>(null)

  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const { data: customers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['parts-customers', partsCompanyId],
    queryFn: () => getPartsCustomers(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const saveMutation = useMutation({
    mutationFn: async (data: CreatePartsCustomerInput) => {
      if (selectedCustomer) {
        return updatePartsCustomer(selectedCustomer.id, data)
      } else {
        return createPartsCustomer(data, partsCompanyId!)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      toast.success(selectedCustomer ? t('customersPage.toastUpdated') : t('customersPage.toastAdded'))
      setIsModalOpen(false)
      setSelectedCustomer(null)
    },
    onError: () => {
      toast.error(t('customersPage.toastSaveError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const customer = await getPartsCustomer(customerId).catch(() => null)
      if (customer) {
        await moveToTrash({
          entityType: 'parts_customer',
          entityId: customerId,
          entityLabel: customer.full_name || t('customersPage.entityLabel'),
          entityData: customer,
          partsCompanyId,
        })
      }
      await deletePartsCustomer(customerId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      toast.success(t('customersPage.toastDeleted'))
    },
    onError: (error) => {
      console.error('Delete parts customer mutation error:', error)
      toast.error(t('customersPage.toastDeleteError') + (error instanceof Error ? error.message : t('customersPage.noRights')))
    },
  })

  const filteredCustomers = customers.filter(customer => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      customer.full_name.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    )
  })

  // Statistics
  const stats = {
    total: customers.length,
    withOrders: customers.filter(c => c.total_orders > 0).length,
    totalSpent: customers.reduce((sum, c) => sum + c.total_spent, 0),
    avgSpent:
      customers.length > 0
        ? customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length
        : 0,
  }

  const handleEdit = (customer: PartsCustomer, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCustomer(customer)
    setIsModalOpen(true)
  }

  const handleDelete = async (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await showConfirm({ message: t('customersPage.confirmDelete'), danger: true })
    if (!ok) return
    deleteMutation.mutate(customerId)
  }

  const handleCopyPublicLink = async (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const publicUrl = `${window.location.origin}/public/parts-customer/${customerId}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success(t('customersPage.toastLinkCopied'), { duration: 2000 })
    } catch {
      toast.error(t('customersPage.toastLinkCopyError'))
    }
  }

  const handleViewProfile = (customerId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    navigate(`/parts/customers/${customerId}`)
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title={i18n.t('cabinet:pages.customers')}
        subtitle={i18n.t('cabinet:pages.totalN', { n: stats.total })}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => {
              setSelectedCustomer(null)
              setIsModalOpen(true)
            }}
            className="cab-btn cab-btn-primary"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">{t('customersPage.add')}</span>
          </button>
        }
      />

      {/* Content */}
      <div className="page-container">

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mb-6">
          <div className="cab-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">{t('customersPage.statCustomers')}</p>
              <Users className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
            </div>
            <p className="text-3xl font-extrabold text-gray-900 tabular" style={{ letterSpacing: '-0.03em' }}>
              {stats.total}
            </p>
          </div>

          <div className="cab-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">{t('customersPage.statWithOrders')}</p>
              <TrendingUp className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
            </div>
            <p className="text-3xl font-extrabold text-emerald-600 tabular" style={{ letterSpacing: '-0.03em' }}>
              {stats.withOrders}
            </p>
          </div>

          <div className="cab-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">{t('customersPage.statRevenue')}</p>
              <DollarSign className="w-4 h-4 text-primary" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-extrabold text-primary tabular" style={{ letterSpacing: '-0.025em' }}>
              {formatCurrency(stats.totalSpent)}
            </p>
          </div>

          <div className="cab-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">{t('customersPage.statAvgCheck')}</p>
              <DollarSign className="w-4 h-4 text-[var(--cab-signal)]" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-extrabold text-[var(--cab-signal)] tabular" style={{ letterSpacing: '-0.025em' }}>
              {formatCurrency(stats.avgSpent)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="cab-card p-4 mb-4">
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="text"
              placeholder={t('customersPage.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input pl-10"
            />
          </div>
        </div>

        {/* Customers list */}
        {isError ? (
          <QueryState isError onRetry={() => { void refetch() }}>{null}</QueryState>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="cab-card p-4">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Users className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
              </div>
              <p className="empty-state-title">
                {searchQuery ? t('customersPage.emptyNotFound') : t('customersPage.emptyNone')}
              </p>
              {!searchQuery && (
                <p className="empty-state-text">
                  {t('customersPage.emptyHint')}
                </p>
              )}
              {!searchQuery && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="cab-btn cab-btn-primary mt-4"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  {t('customersPage.addCustomer')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ── Desktop table (md+) ───────────────────────────── */}
            <div className="cab-card p-0 overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header-cell">{t('customersPage.thCustomer')}</th>
                      <th className="table-header-cell">{t('customersPage.thPhone')}</th>
                      <th className="table-header-cell text-right">{t('customersPage.thOrders')}</th>
                      <th className="table-header-cell text-right">{t('customersPage.thSpent')}</th>
                      <th className="table-header-cell text-right">{t('customersPage.thActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(customer => (
                      <tr
                        key={customer.id}
                        onClick={() => handleViewProfile(customer.id)}
                        className="table-row cursor-pointer group/row"
                      >
                        {/* Имя + аватар */}
                        <td className="table-cell">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`avatar-md flex-shrink-0 ${avatarColor(customer.full_name)}`}
                            >
                              {getInitials(customer.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 group-hover/row:text-primary transition-colors truncate">
                                {customer.full_name}
                              </p>
                              {customer.discount_percent > 0 && (
                                <span className="badge badge-green">
                                  {t('customersPage.discount', { n: customer.discount_percent })}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Телефон */}
                        <td className="table-cell">
                          {customer.phone ? (
                            <a
                              href={`tel:${customer.phone}`}
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                              {customer.phone}
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Заказов */}
                        <td className="table-cell text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular">
                            {customer.total_orders}
                          </span>
                        </td>

                        {/* Потрачено */}
                        <td className="table-cell text-right">
                          <span
                            className="text-sm font-extrabold text-primary tabular"
                            style={{ letterSpacing: '-0.02em' }}
                          >
                            {formatCurrency(customer.total_spent)}
                          </span>
                        </td>

                        {/* Действия */}
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={e => handleCopyPublicLink(customer.id, e)}
                              className="btn-icon-sm text-primary"
                              title={t('customersPage.copyLinkTitle')}
                            >
                              <Link2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={e => handleEdit(customer, e)}
                              className="cab-btn cab-btn-ghost cab-btn-sm"
                            >
                              {t('customersPage.edit')}
                            </button>
                            <button
                              onClick={e => handleDelete(customer.id, e)}
                              className="cab-btn cab-btn-danger cab-btn-sm"
                            >
                              {t('customersPage.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Mobile cards (< md) ───────────────────────────── */}
            <div className="flex flex-col gap-2 md:hidden">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => handleViewProfile(customer.id)}
                  className="cab-card cab-card-hover p-0 overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Avatar */}
                    <span
                      className={`avatar-md flex-shrink-0 ${avatarColor(customer.full_name)}`}
                    >
                      {getInitials(customer.full_name)}
                    </span>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
                        {customer.full_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {[
                          customer.phone,
                          customer.total_orders > 0
                            ? t('customersPage.ordersCount', { count: customer.total_orders })
                            : null,
                          customer.total_spent > 0
                            ? formatCurrency(customer.total_spent)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>

                    {/* Discount badge */}
                    {customer.discount_percent > 0 && (
                      <span className="badge badge-green flex-shrink-0">
                        −{customer.discount_percent}%
                      </span>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="border-t border-gray-100 flex divide-x divide-gray-100">
                    <button
                      onClick={e => handleCopyPublicLink(customer.id, e)}
                      className="flex-none px-4 py-2.5 text-primary hover:bg-slate-50 transition-colors"
                      title={t('customersPage.publicLink')}
                    >
                      <Link2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={e => handleEdit(customer, e)}
                      className="flex-1 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {t('customersPage.edit')}
                    </button>
                    <button
                      onClick={e => handleDelete(customer.id, e)}
                      className="flex-1 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      {t('customersPage.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <PartsCustomerModal
          isOpen={isModalOpen}
          customer={selectedCustomer}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedCustomer(null)
          }}
          onSubmit={data => saveMutation.mutateAsync(data)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
