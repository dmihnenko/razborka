import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { Search, Users, UserCheck, Phone, Mail } from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import { useTranslation } from 'react-i18next'

type ViewMode = 'grid' | 'list'

/** Инициалы для аватара */
function getInitials(name?: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]
function avatarColor(name?: string | null): string {
  if (!name) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function roleBadge(role?: string | null) {
  switch (role) {
    case 'parts_owner':  return <span className="badge badge-blue">{i18n.t('cabinet:employeesPage.roleOwner')}</span>
    case 'parts_worker': return <span className="badge badge-gray">{i18n.t('cabinet:employeesPage.roleWorker')}</span>
    case 'admin':        return <span className="badge badge-purple">{i18n.t('cabinet:employeesPage.roleAdmin')}</span>
    default:             return <span className="badge badge-gray">{role ?? i18n.t('cabinet:employeesPage.roleUser')}</span>
  }
}

export default function PartsEmployees() {
  const { t } = useTranslation('cabinet')
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Получить список сотрудников разборки
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['parts-employees', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return []

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('parts_company_id', partsCompanyId)
        .order('full_name')

      if (error) throw error
      return data || []
    },
    enabled: !!partsCompanyId,
  })

  // Фильтрация по поиску
  const filteredEmployees = employees.filter(emp => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      emp.full_name?.toLowerCase().includes(query) ||
      emp.username?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.phone?.includes(query)
    )
  })

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.email).length,
    withPhone: employees.filter(e => e.phone).length,
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title={i18n.t('cabinet:pages.employees')}
        subtitle={i18n.t('cabinet:pages.totalN', { n: stats.total })}
        backPath="/parts/dashboard"
      />

      {/* Content */}
      <div className="page-container">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4 sm:mb-6">
          <div className="cab-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">{t('employeesPage.statTotal')}</p>
              <Users className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
            </div>
            <p className="text-3xl font-extrabold tabular" style={{ letterSpacing: '-0.03em', color: 'var(--cab-ink)' }}>
              {stats.total}
            </p>
          </div>

          <div className="cab-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">{t('employeesPage.statWithEmail')}</p>
              <UserCheck className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
            </div>
            <p className="text-3xl font-extrabold tabular" style={{ letterSpacing: '-0.03em', color: 'var(--cab-ink)' }}>
              {stats.active}
            </p>
          </div>

          <div className="cab-card p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">{t('employeesPage.statWithPhone')}</p>
              <Phone className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
            </div>
            <p className="text-3xl font-extrabold tabular" style={{ letterSpacing: '-0.03em', color: 'var(--cab-ink)' }}>
              {stats.withPhone}
            </p>
          </div>
        </div>

        {/* Search & View toggle */}
        <div className="cab-card p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder={t('employeesPage.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input pl-10"
              />
            </div>

            {/* View mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('employeesPage.viewGrid')}
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('employeesPage.viewList')}
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="cab-card p-4">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Users className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
              </div>
              <p className="empty-state-title">
                {searchQuery ? t('employeesPage.emptySearch') : t('employeesPage.empty')}
              </p>
              {!searchQuery && (
                <p className="empty-state-text">
                  {t('employeesPage.emptyHint')}
                </p>
              )}
            </div>
          </div>

        ) : viewMode === 'grid' ? (
          /* ── Мобайл/grid: плоские карточки ─────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {filteredEmployees.map(employee => (
              <div key={employee.id} className="cab-card cab-card-hover p-4 flex items-start gap-4">
                {/* Аватар */}
                <span className={`avatar-lg flex-shrink-0 ${avatarColor(employee.full_name)}`}>
                  {getInitials(employee.full_name)}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {employee.full_name || t('employeesPage.noName')}
                    </p>
                    {roleBadge(employee.role)}
                  </div>

                  {employee.username && (
                    <p className="text-xs text-gray-400 mb-1.5">@{employee.username}</p>
                  )}

                  <div className="space-y-1">
                    {employee.email && (
                      <a
                        href={`mailto:${employee.email}`}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{employee.email}</span>
                      </a>
                    )}
                    {employee.phone && (
                      <a
                        href={`tel:${employee.phone}`}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                        {employee.phone}
                      </a>
                    )}
                    {!employee.email && !employee.phone && (
                      <p className="text-xs text-gray-400">{t('employeesPage.noContact')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

        ) : (
          /* ── Десктоп: таблица ───────────────────────────────── */
          <div className="cab-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header-cell">{t('employeesPage.colEmployee')}</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200" style={{ letterSpacing: '0.06em' }}>{t('employeesPage.colRole')}</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200" style={{ letterSpacing: '0.06em' }}>{t('employeesPage.colEmail')}</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200" style={{ letterSpacing: '0.06em' }}>{t('employeesPage.colPhone')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(employee => (
                    <tr key={employee.id} className="table-row">
                      {/* Имя + аватар */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`avatar-md flex-shrink-0 ${avatarColor(employee.full_name)}`}>
                            {getInitials(employee.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {employee.full_name || t('employeesPage.noName')}
                            </p>
                            {employee.username && (
                              <p className="text-xs text-gray-400">@{employee.username}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Роль */}
                      <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                        {roleBadge(employee.role)}
                      </td>

                      {/* Email */}
                      <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                        {employee.email ? (
                          <a
                            href={`mailto:${employee.email}`}
                            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary transition-colors max-w-xs"
                          >
                            <Mail className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                            <span className="truncate">{employee.email}</span>
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Телефон */}
                      <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                        {employee.phone ? (
                          <a
                            href={`tel:${employee.phone}`}
                            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                            {employee.phone}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
