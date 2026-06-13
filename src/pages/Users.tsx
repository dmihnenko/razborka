import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, fetchActiveRoles, fetchPartsCompanies, updateUserRolesFull, toggleUserActive, getAuthSession, softDeleteUserProfile, restoreUserProfile, bulkSetActive, bulkSoftDelete } from '@/services/userService';
import { Plus, Edit2, Trash2, UserCog, Search, CheckCircle2, KeyRound, RotateCcw, X, CheckSquare, Square, LogIn } from 'lucide-react';
import { startImpersonation } from '@/services/impersonationService';
import { toast } from 'sonner';
import { useUserProfile, useIsAdmin } from '@/hooks/useUserProfile';
import { useSubscriptionLimits } from '@/hooks/useSubscription';
import { useConfirm } from '@/hooks/useConfirm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RoleSelector from '@/components/admin/RoleSelector';

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
  roles?: Role[]; // Массив ролей
}

/** Инициалы для аватара */
function getInitials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return (email?.charAt(0) ?? '?').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];
function avatarColor(seed?: string | null): string {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const getRoleBadgeClass = (roleName?: string): string => {
  switch (roleName) {
    case 'admin':        return 'badge badge-red';
    case 'parts_owner':  return 'badge badge-yellow';
    case 'parts_worker': return 'badge badge-green';
    case 'store_owner':  return 'badge badge-orange';
    case 'store_worker': return 'badge badge-blue';
    default:             return 'badge badge-gray';
  }
};

const shouldShowPartsCompany = (roleNames: string[]) =>
  roleNames.some(name => name === 'parts_owner' || name === 'parts_worker');


export default function Users() {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordModal, setPasswordModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Фаза 2: вид (активные / корзина), фильтры, массовый выбор
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm: showConfirm, dialogProps } = useConfirm();

  // Получаем информацию о текущем пользователе
  const isAdmin = useIsAdmin();
  const { data: currentUserProfile } = useUserProfile();
  const { hasSubscription, limits } = useSubscriptionLimits();

  // Определяем роль текущего пользователя
  const isPartsOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'parts_owner');

  // Загрузка пользователей
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', currentUserProfile?.id, isPartsOwner, view],
    queryFn: () => fetchUsers({
      isPartsOwner: !!isPartsOwner,
      isAdmin: !!isAdmin,
      partsCompanyId: currentUserProfile?.parts_company_id,
      onlyDeleted: view === 'trash',
    })
  });

  // Загрузка ролей
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

  // Обновление ролей пользователя
  const updateUserRolesMutation = useMutation({
    mutationFn: (params: {
      userId: string;
      roleIds: string[];
      primaryRoleId?: string;
      parts_company_id?: string | null;
    }) => updateUserRolesFull(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Роли пользователя обновлены');
      setIsRoleModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error('Ошибка при обновлении ролей');
      console.error(error);
    }
  });

  // Создание пользователя
  // Производные значения — ПОСЛЕ всех хуков

  const filteredUsers = useMemo(
    () => {
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
    },
    [users, searchQuery, roleFilter, companyFilter, statusFilter]
  );

  // Сброс выбора при смене вида/фильтров
  const visibleIds = useMemo(() => filteredUsers.map(u => u.id), [filteredUsers]);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (visibleIds.every(id => prev.has(id))) return new Set();
      return new Set(visibleIds);
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Переключение активности пользователя
  const toggleActiveMutation = useMutation({
    mutationFn: (user: UserProfile) => toggleUserActive(user.id, user.is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Статус пользователя изменен');
    },
    onError: (error) => {
      toast.error('Ошибка при изменении статуса');
      console.error(error);
    }
  });

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  // Удаление — мягкое (в корзину, восстановимо)
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => softDeleteUserProfile(userId),
    onSuccess: () => { invalidateUsers(); toast.success('Пользователь перемещён в корзину'); },
    onError: (error: any) => toast.error(`Ошибка: ${error.message || 'не удалось удалить'}`),
  });

  // Восстановление из корзины
  const restoreMutation = useMutation({
    mutationFn: (userId: string) => restoreUserProfile(userId),
    onSuccess: () => { invalidateUsers(); toast.success('Пользователь восстановлен'); },
    onError: (error: any) => toast.error(`Ошибка: ${error.message || 'не удалось восстановить'}`),
  });

  // Перманентное удаление из корзины (auth + профиль) через Edge Function
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

  // Массовые действия
  const bulkMutation = useMutation({
    mutationFn: async (action: 'activate' | 'deactivate' | 'delete') => {
      const ids = Array.from(selectedIds)
      if (action === 'delete') await bulkSoftDelete(ids)
      else await bulkSetActive(ids, action === 'activate')
    },
    onSuccess: (_d, action) => {
      invalidateUsers()
      clearSelection()
      toast.success(action === 'delete' ? 'Удалены в корзину' : action === 'activate' ? 'Активированы' : 'Деактивированы')
    },
    onError: (error: any) => toast.error(`Ошибка: ${error.message || 'массовое действие не выполнено'}`),
  });

  // Смена пароля пользователя (admin/owner)
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const session = await getAuthSession()
      if (!session?.access_token) throw new Error('Сессия истекла')
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId, newPassword: password }),
        }
      )
      const data = await response.json()
      if (!response.ok || data?.error) throw new Error(data?.error || 'Ошибка смены пароля')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Пароль изменён')
      setPasswordModal(null)
      setNewPassword('')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при смене пароля')
    }
  });

  const handleToggleActive = (user: UserProfile) => {
    toggleActiveMutation.mutate(user);
  };

  const handleEditRole = (user: UserProfile) => {
    setSelectedUser({
      ...user,
      roles: user.roles || []
    });
    setIsRoleModalOpen(true);
  };

  const openPasswordModal = (user: UserProfile) => {
    setNewPassword('');
    setPasswordModal({ userId: user.id, userName: user.full_name || user.username || user.email });
  };

  const closePasswordModal = () => {
    setPasswordModal(null);
    setNewPassword('');
  };

  // Сохраняем текущий контекст: из админки → /admin/users/..., из основного → /users/...
  const usersBase = location.pathname.startsWith('/admin') ? '/admin/users' : '/users';

  const handleEditUser = (user: UserProfile) => {
    navigate(`${usersBase}/${user.id}/edit`);
  };

  const handleCreateUser = () => {
    navigate(`${usersBase}/new`);
  };

  const handleDeleteUser = async (user: UserProfile) => {
    const hasAdminRole = user.roles?.some(r => r.name === 'admin');
    if (hasAdminRole) {
      toast.error('Невозможно удалить администратора');
      return;
    }
    const ok = await showConfirm({ message: `Переместить пользователя ${user.full_name || user.email} в корзину? Его можно будет восстановить.`, danger: true });
    if (!ok) return;
    deleteUserMutation.mutate(user.id);
  };

  const handlePurgeUser = async (user: UserProfile) => {
    const ok = await showConfirm({ message: `Удалить НАВСЕГДА пользователя ${user.full_name || user.email}? Это действие необратимо.`, danger: true });
    if (!ok) return;
    purgeMutation.mutate(user.id);
  };

  const handleImpersonate = async (user: UserProfile) => {
    if (user.roles?.some(r => r.name === 'admin')) { toast.error('Нельзя войти под администратором'); return; }
    const ok = await showConfirm({ message: `Войти под пользователем ${user.full_name || user.email}? Вы сможете вернуться в свой аккаунт.` });
    if (!ok) return;
    try {
      toast.loading('Вход...', { id: 'imp' });
      await startImpersonation(user.id);
      toast.dismiss('imp');
      window.location.href = '/';
    } catch (e: any) {
      toast.dismiss('imp');
      toast.error(e.message || 'Не удалось войти');
    }
  };

  const handleBulk = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedIds.size === 0) return;
    if (action === 'delete') {
      const ok = await showConfirm({ message: `Переместить выбранных (${selectedIds.size}) в корзину?`, danger: true });
      if (!ok) return;
    }
    bulkMutation.mutate(action);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <span className="spinner spinner-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Подписка */}
      {isPartsOwner && !isAdmin && (
        <div className={`alert ${hasSubscription ? 'alert-success' : 'alert-warning'}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasSubscription
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <span className="flex-shrink-0">⚠️</span>
            }
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
          <button onClick={handleCreateUser} className="btn-primary flex items-center gap-2">
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
            <button key={t.id}
              onClick={() => { setView(t.id); clearSelection(); }}
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
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="form-select w-auto">
              <option value="all">Все роли</option>
              {roles.map((r: any) => <option key={r.id} value={r.name}>{r.display_name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="form-select w-auto">
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
            {isAdmin && (
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
                className="form-select w-auto max-w-[160px]">
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

      {/* Панель массовых действий */}
      {isAdmin && view === 'active' && selectedIds.size > 0 && (
        <div className="alert alert-info flex items-center justify-between gap-3 flex-wrap">
          <span className="font-semibold">Выбрано: {selectedIds.size}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleBulk('activate')} disabled={bulkMutation.isPending}
              className="btn-success btn-sm">Активировать</button>
            <button onClick={() => handleBulk('deactivate')} disabled={bulkMutation.isPending}
              className="btn-secondary btn-sm">Деактивировать</button>
            <button onClick={() => handleBulk('delete')} disabled={bulkMutation.isPending}
              className="btn-danger btn-sm">В корзину</button>
            <button onClick={clearSelection}
              className="btn-ghost btn-sm flex items-center gap-1">
              <X className="w-3.5 h-3.5" />Снять
            </button>
          </div>
        </div>
      )}

      {/* Выбрать всё */}
      {isAdmin && view === 'active' && filteredUsers.length > 0 && (
        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 -mb-2">
          {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
          {allSelected ? 'Снять выбор' : 'Выбрать всё'}
        </button>
      )}

      {/* ── Список: мобайл — плоские карточки, десктоп — таблица ── */}

      {/* Мобайл: карточки (hidden на sm+) */}
      <div className="sm:hidden space-y-2">
        {filteredUsers.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <UserCog className="w-7 h-7 text-gray-400" />
              </div>
              <p className="empty-state-title">
                {view === 'trash' ? 'Корзина пуста' : (searchQuery || roleFilter !== 'all' || companyFilter !== 'all' || statusFilter !== 'all') ? 'Ничего не найдено' : 'Нет пользователей'}
              </p>
              {view === 'active' && (searchQuery || roleFilter !== 'all') && (
                <p className="empty-state-text">Попробуйте изменить запрос или фильтры</p>
              )}
            </div>
          </div>
        ) : filteredUsers.map((user) => {
          const company = user.parts_companies?.name || null;
          const primaryRole = user.roles && user.roles.length > 0
            ? (user.roles.find((r: Role) => r.is_primary) || user.roles[0])
            : null;
          const extraRoles = user.roles ? user.roles.length - 1 : 0;
          const selectable = isAdmin && view === 'active';
          const isSel = selectedIds.has(user.id);

          const actions = view === 'trash'
            ? [
                { key: 'restore', show: isAdmin, title: 'Восстановить', Icon: RotateCcw, cls: 'text-emerald-600', onClick: () => restoreMutation.mutate(user.id) },
                { key: 'purge',   show: isAdmin, title: 'Удалить навсегда', Icon: Trash2, cls: 'text-red-500', onClick: () => handlePurgeUser(user) },
              ].filter(a => a.show)
            : [
                { key: 'edit',      show: true,                               title: 'Редактировать',  Icon: Edit2,        cls: 'text-primary',    onClick: () => handleEditUser(user) },
                { key: 'pwd',       show: isAdmin || isPartsOwner,            title: 'Сменить пароль', Icon: KeyRound,     cls: 'text-amber-600',  onClick: () => openPasswordModal(user) },
                { key: 'roles',     show: isAdmin,                            title: 'Роли',           Icon: UserCog,      cls: 'text-purple-600', onClick: () => handleEditRole(user) },
                { key: 'login-as',  show: isAdmin && !user.roles?.some(r => r.name === 'admin'), title: 'Войти как', Icon: LogIn, cls: 'text-sky-600', onClick: () => handleImpersonate(user) },
                { key: 'activate',  show: isAdmin && !user.is_active,         title: 'Активировать',  Icon: CheckCircle2, cls: 'text-emerald-600', onClick: () => handleToggleActive(user) },
                { key: 'delete',    show: isAdmin,                            title: 'В корзину',      Icon: Trash2,       cls: 'text-red-500',    onClick: () => handleDeleteUser(user) },
              ].filter(a => a.show);

          return (
            <div key={user.id} className={`card p-3.5 transition-colors ${isSel ? 'ring-2 ring-primary/40' : ''}`}>
              <div className="flex items-start gap-3">
                {selectable && (
                  <button onClick={() => toggleSelect(user.id)} className="flex-shrink-0 mt-1 btn-icon-sm" aria-label="Выбрать">
                    {isSel ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-gray-300" />}
                  </button>
                )}

                {/* Аватар */}
                <span className={`avatar-md flex-shrink-0 ${avatarColor(user.full_name || user.email)}`}>
                  {getInitials(user.full_name, user.email)}
                </span>

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {user.full_name || <span className="text-gray-400 font-normal">Имя не указано</span>}
                    </span>
                    <span className={`badge ${user.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {user.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {user.email}{user.username ? <span className="font-mono"> · @{user.username}</span> : null}
                  </p>

                  {/* Роли + компания */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {primaryRole ? (
                      <>
                        <span className={getRoleBadgeClass(primaryRole.name)}>
                          {primaryRole.display_name}
                        </span>
                        {extraRoles > 0 && (
                          <span title={user.roles!.slice(1).map((r: Role) => r.display_name).join(', ')}
                            className="badge badge-gray cursor-default">
                            +{extraRoles}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Без роли</span>
                    )}
                    {company && (
                      <span className="badge badge-gray max-w-[160px] truncate">{company}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Действия — мобайл: крупные тач-таргеты */}
              {actions.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  {actions.map(({ key, title, Icon, cls, onClick }) => (
                    <button key={key} onClick={onClick} aria-label={title}
                      className={`flex-1 min-h-[44px] flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50 active:scale-95 transition-all ${cls}`}>
                      <Icon className="w-[18px] h-[18px]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Десктоп: таблица (hidden на mobile) */}
      <div className="hidden sm:block card p-0 overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <UserCog className="w-7 h-7 text-gray-400" />
            </div>
            <p className="empty-state-title">
              {view === 'trash' ? 'Корзина пуста' : (searchQuery || roleFilter !== 'all' || companyFilter !== 'all' || statusFilter !== 'all') ? 'Ничего не найдено' : 'Нет пользователей'}
            </p>
            {view === 'active' && (searchQuery || roleFilter !== 'all') && (
              <p className="empty-state-text">Попробуйте изменить запрос или фильтры</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {isAdmin && view === 'active' && (
                    <th className="table-header-cell w-10">
                      <button onClick={toggleSelectAll} aria-label="Выбрать всё" className="btn-icon-sm mx-auto">
                        {allSelected
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                  )}
                  <th className="table-header-cell">Пользователь</th>
                  <th className="table-header-cell hidden md:table-cell">Роль</th>
                  <th className="table-header-cell hidden lg:table-cell">Компания</th>
                  <th className="table-header-cell hidden sm:table-cell">Статус</th>
                  <th className="table-header-cell text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const company = user.parts_companies?.name || null;
                  const primaryRole = user.roles && user.roles.length > 0
                    ? (user.roles.find((r: Role) => r.is_primary) || user.roles[0])
                    : null;
                  const extraRoles = user.roles ? user.roles.length - 1 : 0;
                  const selectable = isAdmin && view === 'active';
                  const isSel = selectedIds.has(user.id);

                  const actions = view === 'trash'
                    ? [
                        { key: 'restore', show: isAdmin, title: 'Восстановить', Icon: RotateCcw, cls: 'text-emerald-600 hover:bg-emerald-50', onClick: () => restoreMutation.mutate(user.id) },
                        { key: 'purge',   show: isAdmin, title: 'Удалить навсегда', Icon: Trash2, cls: 'text-red-500 hover:bg-red-50', onClick: () => handlePurgeUser(user) },
                      ].filter(a => a.show)
                    : [
                        { key: 'edit',     show: true,                                              title: 'Редактировать',  Icon: Edit2,        cls: 'hover:text-primary hover:bg-blue-50',     onClick: () => handleEditUser(user) },
                        { key: 'pwd',      show: isAdmin || isPartsOwner,                           title: 'Сменить пароль', Icon: KeyRound,     cls: 'hover:text-amber-600 hover:bg-amber-50',  onClick: () => openPasswordModal(user) },
                        { key: 'roles',    show: isAdmin,                                           title: 'Роли',           Icon: UserCog,      cls: 'hover:text-purple-600 hover:bg-purple-50', onClick: () => handleEditRole(user) },
                        { key: 'login-as', show: isAdmin && !user.roles?.some(r => r.name === 'admin'), title: 'Войти как', Icon: LogIn, cls: 'hover:text-sky-600 hover:bg-sky-50', onClick: () => handleImpersonate(user) },
                        { key: 'activate', show: isAdmin && !user.is_active,                        title: 'Активировать',  Icon: CheckCircle2, cls: 'hover:text-emerald-600 hover:bg-emerald-50', onClick: () => handleToggleActive(user) },
                        { key: 'delete',   show: isAdmin,                                           title: 'В корзину',     Icon: Trash2,       cls: 'hover:text-red-500 hover:bg-red-50',      onClick: () => handleDeleteUser(user) },
                      ].filter(a => a.show);

                  return (
                    <tr key={user.id} className={`table-row ${isSel ? 'bg-blue-50/60' : ''}`}>
                      {selectable && (
                        <td className="table-cell w-10">
                          <button onClick={() => toggleSelect(user.id)} aria-label="Выбрать" className="btn-icon-sm mx-auto">
                            {isSel ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-gray-300" />}
                          </button>
                        </td>
                      )}

                      {/* Пользователь */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`avatar-md flex-shrink-0 ${avatarColor(user.full_name || user.email)}`}>
                            {getInitials(user.full_name, user.email)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {user.full_name || <span className="text-gray-400 font-normal">Имя не указано</span>}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {user.email}{user.username ? <span className="font-mono"> · @{user.username}</span> : null}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Роль */}
                      <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {primaryRole ? (
                            <>
                              <span className={getRoleBadgeClass(primaryRole.name)}>
                                {primaryRole.display_name}
                              </span>
                              {extraRoles > 0 && (
                                <span title={user.roles!.slice(1).map((r: Role) => r.display_name).join(', ')}
                                  className="badge badge-gray cursor-default">
                                  +{extraRoles}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Без роли</span>
                          )}
                        </div>
                      </td>

                      {/* Компания */}
                      <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                        {company
                          ? <span className="badge badge-gray max-w-[160px] truncate">{company}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Статус */}
                      <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                        <span className={`badge ${user.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {user.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>

                      {/* Действия */}
                      <td className="table-cell">
                        <div className="flex items-center gap-0.5 justify-end">
                          {actions.map(({ key, title, Icon, cls, onClick }) => (
                            <button key={key} onClick={onClick} title={title}
                              className={`btn-icon ${cls}`}>
                              <Icon className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Назначение ролей — bottom-sheet на мобиле, диалог на десктопе */}
      {isRoleModalOpen && selectedUser && (() => {
        const userRoleIds = selectedUser.roles?.map(r => r.id) || [];
        const roleNames = selectedUser.roles?.map(r => r.name) || [];
        const needsParts = shouldShowPartsCompany(roleNames);
        const partsMissing = needsParts && !selectedUser.parts_company_id;
        const canSaveRoles = userRoleIds.length > 0 && !partsMissing;

        const closeRoleModal = () => { setIsRoleModalOpen(false); setSelectedUser(null); };

        return (
          <div className="modal-overlay">
            <div className="modal-sheet animate-slide-up">
              <div className="modal-handle" />

              {/* Хедер */}
              <div className="modal-header">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="icon-tile-sm bg-purple-100 flex-shrink-0">
                    <UserCog className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-gray-900">Роли и доступ</h2>
                    <p className="text-xs text-gray-400 truncate">{selectedUser.full_name || selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={closeRoleModal} className="btn-icon flex-shrink-0" aria-label="Закрыть">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Тело */}
              <div className="modal-body space-y-5">
                {/* Роли */}
                <div>
                  <label className="kicker block mb-2">Роли</label>
                  <RoleSelector
                    roles={roles}
                    selectedIds={userRoleIds}
                    primaryId={selectedUser.roles?.find(r => r.is_primary)?.id || selectedUser.roles?.[0]?.id || ''}
                    onChange={(ids, pid) => {
                      const newRoles = ids
                        .map(id => roles.find(r => r.id === id))
                        .filter((r): r is Role => !!r)
                        .map(r => ({ ...r, is_primary: r.id === pid }));
                      setSelectedUser({ ...selectedUser, roles: newRoles });
                    }}
                  />
                </div>

                {/* Разборка */}
                {needsParts && (
                  <div>
                    <label className="kicker block mb-2">Разборка *</label>
                    <select
                      value={selectedUser.parts_company_id || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, parts_company_id: e.target.value || null })}
                      className={`modal-input ${partsMissing ? 'border-red-300' : ''}`}
                    >
                      <option value="">Выберите разборку</option>
                      {partsCompanies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                    {partsMissing && <p className="form-error">Укажите разборку</p>}
                  </div>
                )}
              </div>

              {/* Футер */}
              <div className="modal-footer">
                <button onClick={closeRoleModal} className="modal-btn-cancel">
                  Отмена
                </button>
                <button
                  disabled={!canSaveRoles || updateUserRolesMutation.isPending}
                  onClick={() => {
                    const roleIds = selectedUser.roles?.map(r => r.id) || [];
                    const primaryRoleId = selectedUser.roles?.find(r => r.is_primary)?.id || roleIds[0];
                    updateUserRolesMutation.mutate({
                      userId: selectedUser.id,
                      roleIds,
                      primaryRoleId,
                      parts_company_id: selectedUser.parts_company_id
                    });
                  }}
                  className="modal-btn-primary bg-purple-600 hover:bg-purple-700"
                  style={{ backgroundImage: 'none' }}
                >
                  {updateUserRolesMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      <ConfirmDialog {...dialogProps} />

      {/* Модалка смены пароля */}
      {passwordModal && (
        <div className="modal-overlay">
          <div className="modal-sheet sm:max-w-sm animate-slide-up">
            <div className="modal-handle" />

            <div className="modal-header">
              <div className="flex items-center gap-3 min-w-0">
                <div className="icon-tile-sm bg-amber-100 flex-shrink-0">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">Смена пароля</p>
                  <p className="text-xs text-gray-400 truncate">{passwordModal.userName}</p>
                </div>
              </div>
              <button onClick={closePasswordModal} className="btn-icon flex-shrink-0" aria-label="Закрыть">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="kicker block mb-2">Новый пароль</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoFocus
                  placeholder="Минимум 6 символов"
                  className="modal-input"
                />
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="form-error">Минимум 6 символов</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={closePasswordModal} className="modal-btn-cancel">
                Отмена
              </button>
              <button
                onClick={() => changePasswordMutation.mutate({ userId: passwordModal.userId, password: newPassword })}
                disabled={newPassword.length < 6 || changePasswordMutation.isPending}
                className="modal-btn-primary flex items-center justify-center gap-2"
              >
                {changePasswordMutation.isPending
                  ? <span className="spinner-sm" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  : <KeyRound className="w-4 h-4" />}
                {changePasswordMutation.isPending ? 'Сохранение...' : 'Сменить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
