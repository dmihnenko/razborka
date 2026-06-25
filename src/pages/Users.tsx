import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, fetchActiveRoles, fetchPartsCompanies, getAuthSession, restoreUserProfile } from '@/services/userService';
import { Plus, Search, Trash2, RotateCcw, UserCog, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useUserProfile, useIsAdmin } from '@/hooks/useUserProfile';
import { useSubscriptionLimits } from '@/hooks/useSubscription';
import { useConfirm } from '@/hooks/useConfirm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  is_primary?: boolean;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  username: string | null;
  role_id: string | null;
  parts_company_id: string | null;
  is_active: boolean;
  roles?: Role[];
  parts_companies?: { name: string } | null;
}

const getRoleBadgeClass = (roleName?: string): string => {
  switch (roleName) {
    case 'admin':        return 'badge badge-red';
    case 'parts_owner':  return 'badge badge-yellow';
    case 'parts_worker': return 'badge badge-green';
    default:             return 'badge badge-gray';
  }
};

/** Роли пользователя строкой: основная + «+N» */
function RoleCell({ user }: { user: UserProfile }) {
  const primaryRole = user.roles && user.roles.length > 0
    ? (user.roles.find((r: Role) => r.is_primary) || user.roles[0])
    : null;
  const extraRoles = user.roles ? user.roles.length - 1 : 0;
  if (!primaryRole) return <span className="text-xs text-gray-400 italic">Без роли</span>;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={getRoleBadgeClass(primaryRole.name)}>{primaryRole.display_name}</span>
      {extraRoles > 0 && (
        <span title={user.roles!.slice(1).map((r: Role) => r.display_name).join(', ')}
          className="badge badge-gray cursor-default">+{extraRoles}</span>
      )}
    </div>
  );
}

export default function Users() {
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm: showConfirm, dialogProps } = useConfirm();

  const isAdmin = useIsAdmin();
  const { data: currentUserProfile } = useUserProfile();
  const { hasSubscription, limits } = useSubscriptionLimits();

  const isPartsOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'parts_owner');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', currentUserProfile?.id, isPartsOwner, view],
    queryFn: () => fetchUsers({
      isPartsOwner: !!isPartsOwner,
      isAdmin: !!isAdmin,
      partsCompanyId: currentUserProfile?.parts_company_id,
      onlyDeleted: view === 'trash',
    })
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: () => fetchActiveRoles()
  });

  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts_companies'],
    staleTime: 15 * 60 * 1000,
    queryFn: () => fetchPartsCompanies()
  });

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter(user => {
      if (q && !(
        user.full_name?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q) ||
        user.username?.toLowerCase().includes(q) ||
        user.phone?.includes(q)
      )) return false;
      if (roleFilter !== 'all' && !(user.roles?.some((r: Role) => r.name === roleFilter))) return false;
      if (companyFilter !== 'all') {
        if (companyFilter === 'none') {
          if (user.parts_company_id) return false;
        } else if (user.parts_company_id !== companyFilter) {
          return false;
        }
      }
      if (statusFilter === 'active' && !user.is_active) return false;
      if (statusFilter === 'inactive' && user.is_active) return false;
      return true;
    });
  }, [users, searchQuery, roleFilter, companyFilter, statusFilter]);

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  // Корзина: восстановление и перманентное удаление
  const restoreMutation = useMutation({
    mutationFn: (userId: string) => restoreUserProfile(userId),
    onSuccess: () => { invalidateUsers(); toast.success('Пользователь восстановлен'); },
    onError: (error: any) => toast.error(`Ошибка: ${error.message || 'не удалось восстановить'}`),
  });

  const purgeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const session = await getAuthSession()
      if (!session?.access_token) throw new Error('Сессия истекла. Войдите заново.')
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId }),
        }
      )
      const data = await response.json()
      if (!response.ok || data?.error) throw new Error(data?.error || 'Ошибка удаления')
    },
    onSuccess: () => { invalidateUsers(); toast.success('Пользователь удалён навсегда'); },
    onError: (error: any) => toast.error(`Ошибка: ${error.message || 'не удалось удалить'}`),
  });

  // Контекст: из админки → /admin/users/..., из основного → /users/...
  const usersBase = location.pathname.startsWith('/admin') ? '/admin/users' : '/users';
  const openUser = (user: UserProfile) => navigate(`${usersBase}/${user.id}/edit`);
  const handleCreateUser = () => navigate(`${usersBase}/new`);

  const handlePurgeUser = async (user: UserProfile) => {
    const ok = await showConfirm({ message: `Удалить НАВСЕГДА пользователя ${user.full_name || user.email}? Это действие необратимо.`, danger: true });
    if (!ok) return;
    purgeMutation.mutate(user.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <span className="spinner spinner-sm" />
      </div>
    );
  }

  const emptyTitle = view === 'trash'
    ? 'Корзина пуста'
    : (searchQuery || roleFilter !== 'all' || companyFilter !== 'all' || statusFilter !== 'all') ? 'Ничего не найдено' : 'Нет пользователей';

  return (
    <div className="space-y-5">

      {/* Подписка */}
      {isPartsOwner && !isAdmin && (
        <div className={`alert ${hasSubscription ? 'alert-success' : 'alert-warning'}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold">{hasSubscription ? 'Активная подписка' : 'Без подписки'}</span>
            {!hasSubscription && <span className="text-xs opacity-80">· Свяжитесь с администратором</span>}
          </div>
          <span className="kicker flex-shrink-0">
            {users.length} / {hasSubscription ? '∞' : limits.parts?.workers}
          </span>
        </div>
      )}

      {/* Хедер */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isAdmin ? 'Пользователи' : isPartsOwner ? 'Сотрудники разборки' : 'Пользователи'}
          </h1>
          <p className="page-subtitle kicker mt-0.5">{filteredUsers.length} из {users.length}</p>
        </div>
        {isAdmin && view === 'active' && (
          <button onClick={handleCreateUser} className="cab-btn cab-btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Добавить пользователя</span>
            <span className="sm:hidden">Добавить</span>
          </button>
        )}
      </div>

      {/* Вкладки: активные / корзина (admin) */}
      {isAdmin && (
        <div className="flex gap-1.5">
          {([{ id: 'active', label: 'Активные' }, { id: 'trash', label: 'Корзина' }] as const).map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={`chip ${view === t.id ? 'chip-active' : ''}`}>
              {t.id === 'trash' && <Trash2 className="w-3.5 h-3.5" />}{t.label}
            </button>
          ))}
        </div>
      )}

      {/* Поиск + фильтры */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по имени, email, логину..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        {view === 'active' && (
          <div className="flex gap-2 flex-wrap">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="form-select w-auto">
              <option value="all">Все роли</option>
              {roles.map((r: any) => <option key={r.id} value={r.name}>{r.display_name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="form-select w-auto">
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
            {isAdmin && (
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="form-select w-auto max-w-[160px]">
                <option value="all">Все компании</option>
                <option value="none">Без компании</option>
                <optgroup label="Разборки">
                  {partsCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Пусто */}
      {filteredUsers.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <div className="empty-state-icon"><UserCog className="w-7 h-7 text-gray-400" /></div>
            <p className="empty-state-title">{emptyTitle}</p>
            {view === 'active' && (searchQuery || roleFilter !== 'all') && (
              <p className="empty-state-text">Попробуйте изменить запрос или фильтры</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Мобайл: строки-ссылки ── */}
          <div className="sm:hidden space-y-2">
            {filteredUsers.map((user) => {
              const company = user.parts_companies?.name || null;
              const isTrash = view === 'trash';
              return (
                <div key={user.id}
                  onClick={() => !isTrash && openUser(user)}
                  className={`card p-3.5 ${isTrash ? '' : 'cursor-pointer active:scale-[0.99] transition-transform'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {user.full_name || <span className="text-gray-400 font-normal">Имя не указано</span>}
                        </span>
                        <span className={`badge ${user.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {user.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {user.email}{user.username ? <span className="font-mono"> · @{user.username}</span> : null}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <RoleCell user={user} />
                        {company && <span className="badge badge-gray max-w-[160px] truncate">{company}</span>}
                      </div>
                    </div>
                    {!isTrash && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                  </div>

                  {isTrash && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => restoreMutation.mutate(user.id)}
                        className="cab-btn cab-btn-secondary cab-btn-sm flex-1">
                        <RotateCcw className="w-3.5 h-3.5" /> Восстановить
                      </button>
                      <button onClick={() => handlePurgeUser(user)}
                        className="cab-btn cab-btn-danger cab-btn-sm flex-1">
                        <Trash2 className="w-3.5 h-3.5" /> Удалить
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Десктоп: таблица, строки-ссылки ── */}
          <div className="hidden sm:block card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header-cell">Пользователь</th>
                    <th className="table-header-cell hidden md:table-cell">Роль</th>
                    <th className="table-header-cell hidden lg:table-cell">Компания</th>
                    <th className="table-header-cell hidden sm:table-cell">Статус</th>
                    {view === 'trash' && <th className="table-header-cell text-right">Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const company = user.parts_companies?.name || null;
                    const isTrash = view === 'trash';
                    return (
                      <tr key={user.id}
                        onClick={() => !isTrash && openUser(user)}
                        className={`table-row ${isTrash ? '' : 'cursor-pointer hover:bg-gray-50'}`}>
                        <td className="table-cell">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {user.full_name || <span className="text-gray-400 font-normal">Имя не указано</span>}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {user.email}{user.username ? <span className="font-mono"> · @{user.username}</span> : null}
                            </p>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-3 py-2 text-sm border-b border-gray-100">
                          <RoleCell user={user} />
                        </td>
                        <td className="hidden lg:table-cell px-3 py-2 text-sm text-gray-700 border-b border-gray-100">
                          {company
                            ? <span className="badge badge-gray max-w-[160px] truncate">{company}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="hidden sm:table-cell px-3 py-2 text-sm border-b border-gray-100">
                          <span className={`badge ${user.is_active ? 'badge-green' : 'badge-gray'}`}>
                            {user.is_active ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        {isTrash && (
                          <td className="table-cell">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => restoreMutation.mutate(user.id)}
                                className="cab-btn cab-btn-secondary cab-btn-sm">
                                <RotateCcw className="w-3.5 h-3.5" /> Восстановить
                              </button>
                              <button onClick={() => handlePurgeUser(user)}
                                className="cab-btn cab-btn-danger cab-btn-sm">
                                <Trash2 className="w-3.5 h-3.5" /> Удалить
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
