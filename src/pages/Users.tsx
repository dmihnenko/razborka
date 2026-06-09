import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, fetchActiveRoles, fetchStoCompanies, fetchPartsCompanies, updateUserRolesFull, toggleUserActive, getAuthSession, softDeleteUserProfile, restoreUserProfile, bulkSetActive, bulkSoftDelete } from '@/services/userService';
import { Plus, Edit2, Trash2, UserCog, Search, CheckCircle2, KeyRound, RotateCcw, X, CheckSquare, Square } from 'lucide-react';
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
  sto_company_id: string | null;
  parts_company_id: string | null;
  is_active: boolean;
  roles?: Role[]; // Массив ролей
}


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
  const { confirm: showConfirm, dialogProps } = useConfirm();
  
  // Получаем информацию о текущем пользователе
  const isAdmin = useIsAdmin();
  const { data: currentUserProfile } = useUserProfile();
  const { hasSubscription, limits } = useSubscriptionLimits();
  
  // Определяем роль текущего пользователя
  const isStoOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'sto_owner');
  const isPartsOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'parts_owner');

  // Загрузка пользователей
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', currentUserProfile?.id, isStoOwner, isPartsOwner, view],
    queryFn: () => fetchUsers({
      isStoOwner: !!isStoOwner,
      isPartsOwner: !!isPartsOwner,
      isAdmin: !!isAdmin,
      stoCompanyId: currentUserProfile?.sto_company_id,
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

  // Загрузка СТО
  const { data: stoCompanies = [] } = useQuery({
    queryKey: ['sto_companies'],
    staleTime: 15 * 60 * 1000,
    queryFn: () => fetchStoCompanies()
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
      sto_company_id?: string | null;
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
            if (user.sto_company_id || user.parts_company_id) return false;
          } else if (user.sto_company_id !== companyFilter && user.parts_company_id !== companyFilter) {
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

  const handleEditUser = (user: UserProfile) => {
    navigate(`/users/${user.id}/edit`);
  };

  const handleCreateUser = () => {
    navigate('/users/new');
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

  const handleBulk = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedIds.size === 0) return;
    if (action === 'delete') {
      const ok = await showConfirm({ message: `Переместить выбранных (${selectedIds.size}) в корзину?`, danger: true });
      if (!ok) return;
    }
    bulkMutation.mutate(action);
  };

  // Отслеживание изменения ролей


  const getRoleBadgeColor = (roleName?: string) => {
    switch (roleName) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'sto_owner':
        return 'bg-purple-100 text-purple-800';
      case 'sto_worker':
        return 'bg-blue-100 text-blue-800';
      case 'parts_owner':
        return 'bg-yellow-100 text-yellow-800';
      case 'parts_worker':
        return 'bg-green-100 text-green-800';
      case 'store_owner':
        return 'bg-pink-100 text-pink-800';
      case 'store_worker':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const shouldShowStoCompany = (roleNames: string[]) => {
    return roleNames.some(name => name === 'sto_owner' || name === 'sto_worker');
  };

  const shouldShowPartsCompany = (roleNames: string[]) => {
    return roleNames.some(name => name === 'parts_owner' || name === 'parts_worker');
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">Загрузка...</span>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-5">
      {/* Подписка */}
      {(isStoOwner || isPartsOwner) && !isAdmin && (
        <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl text-sm ${hasSubscription ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
          <div className="flex items-center gap-2">
            {hasSubscription
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <span className="flex-shrink-0">⚠️</span>
            }
            <span className="font-medium">{hasSubscription ? 'Активная подписка' : 'Без подписки'}</span>
            {!hasSubscription && <span className="text-xs opacity-80">· Свяжитесь с администратором</span>}
          </div>
          <span className="text-xs opacity-70 flex-shrink-0">
            Сотрудников: {users.length} / {hasSubscription ? '∞' : (isStoOwner ? limits.sto?.workers : limits.parts?.workers)}
          </span>
        </div>
      )}

      {/* Хедер */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isAdmin ? 'Пользователи' : isStoOwner ? 'Сотрудники СТО' : isPartsOwner ? 'Сотрудники разборки' : 'Пользователи'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{filteredUsers.length} из {users.length}</p>
        </div>
        {isAdmin && view === 'active' && (
          <button onClick={handleCreateUser}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" />
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
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {t.id === 'trash' && <Trash2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}{t.label}
            </button>
          ))}
        </div>
      )}

      {/* Поиск + фильтры */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени, email, логину..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 shadow-sm transition-all"
          />
        </div>
        {view === 'active' && (
          <div className="flex gap-2">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-indigo-400 shadow-sm">
              <option value="all">Все роли</option>
              {roles.map((r: any) => <option key={r.id} value={r.name}>{r.display_name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-indigo-400 shadow-sm">
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
            {isAdmin && (
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-indigo-400 shadow-sm max-w-[160px]">
                <option value="all">Все компании</option>
                <option value="none">Без компании</option>
                <optgroup label="СТО">
                  {stoCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
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
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl flex-wrap">
          <span className="text-sm font-semibold text-indigo-700">Выбрано: {selectedIds.size}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleBulk('activate')} disabled={bulkMutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Активировать</button>
            <button onClick={() => handleBulk('deactivate')} disabled={bulkMutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50">Деактивировать</button>
            <button onClick={() => handleBulk('delete')} disabled={bulkMutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">В корзину</button>
            <button onClick={clearSelection}
              className="px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 rounded-lg flex items-center gap-1"><X className="w-3.5 h-3.5" />Снять</button>
          </div>
        </div>
      )}

      {/* Выбрать всё */}
      {isAdmin && view === 'active' && filteredUsers.length > 0 && (
        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 -mb-2">
          {allSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
          {allSelected ? 'Снять выбор' : 'Выбрать всё'}
        </button>
      )}

      {/* Список пользователей */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserCog className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {view === 'trash' ? 'Корзина пуста' : (searchQuery || roleFilter !== 'all' || companyFilter !== 'all' || statusFilter !== 'all') ? 'Ничего не найдено' : 'Нет пользователей'}
            </p>
            {view === 'active' && (searchQuery || roleFilter !== 'all') && <p className="text-xs mt-1 opacity-70">Попробуйте изменить запрос или фильтры</p>}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => {
              const company = user.sto_companies?.name || user.parts_companies?.name || null
              const primaryRole = user.roles && user.roles.length > 0
                ? (user.roles.find((r: Role) => r.is_primary) || user.roles[0])
                : null
              const extraRoles = user.roles ? user.roles.length - 1 : 0

              const actions = view === 'trash'
                ? [
                    { key: 'restore', show: isAdmin, title: 'Восстановить', Icon: RotateCcw, cls: 'text-emerald-600 hover:bg-emerald-50', onClick: () => restoreMutation.mutate(user.id) },
                    { key: 'purge', show: isAdmin, title: 'Удалить навсегда', Icon: Trash2, cls: 'text-red-500 hover:bg-red-50', onClick: () => handlePurgeUser(user) },
                  ].filter(a => a.show)
                : [
                    { key: 'edit', show: true, title: 'Редактировать', Icon: Edit2, cls: 'text-indigo-600 hover:bg-indigo-50', onClick: () => handleEditUser(user) },
                    { key: 'pwd', show: isAdmin || isStoOwner || isPartsOwner, title: 'Сменить пароль', Icon: KeyRound, cls: 'text-amber-600 hover:bg-amber-50', onClick: () => openPasswordModal(user) },
                    { key: 'roles', show: isAdmin, title: 'Роли', Icon: UserCog, cls: 'text-purple-600 hover:bg-purple-50', onClick: () => handleEditRole(user) },
                    { key: 'activate', show: isAdmin && !user.is_active, title: 'Активировать', Icon: CheckCircle2, cls: 'text-emerald-600 hover:bg-emerald-50', onClick: () => handleToggleActive(user) },
                    { key: 'delete', show: isAdmin, title: 'В корзину', Icon: Trash2, cls: 'text-red-500 hover:bg-red-50', onClick: () => handleDeleteUser(user) },
                  ].filter(a => a.show)

              const selectable = isAdmin && view === 'active'
              const isSel = selectedIds.has(user.id)

              return (
                <div key={user.id} className={`px-4 py-3.5 transition-colors ${isSel ? 'bg-indigo-50/60' : 'hover:bg-gray-50/80'}`}>
                  <div className="flex items-start gap-3">
                    {/* Чекбокс выбора */}
                    {selectable && (
                      <button onClick={() => toggleSelect(user.id)} className="flex-shrink-0 mt-1" aria-label="Выбрать">
                        {isSel ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-gray-300" />}
                      </button>
                    )}
                    {/* Аватар */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                      {(user.full_name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                    </div>

                    {/* Инфо */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {user.full_name || <span className="text-gray-400 font-normal">Имя не указано</span>}
                        </span>
                        <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {user.email}{user.username ? <span className="font-mono"> · @{user.username}</span> : null}
                      </p>

                      {/* Роли + компания — всегда видны (в т.ч. на мобиле) */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {primaryRole ? (
                          <>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${getRoleBadgeColor(primaryRole.name)}`}>
                              {primaryRole.display_name}
                            </span>
                            {extraRoles > 0 && (
                              <span title={user.roles!.slice(1).map((r: Role) => r.display_name).join(', ')}
                                className="text-[11px] text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded-md cursor-default whitespace-nowrap">
                                +{extraRoles}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Без роли</span>
                        )}
                        {company && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-md max-w-[160px] truncate">
                            {company}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Действия — десктоп */}
                    <div className="hidden sm:flex items-center gap-0.5 flex-shrink-0">
                      {actions.map(({ key, title, Icon, cls, onClick }) => (
                        <button key={key} onClick={onClick} title={title}
                          className={`p-2.5 rounded-lg transition-colors ${cls}`}>
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Действия — мобайл: крупные тач-таргеты, на всю ширину */}
                  <div className="flex sm:hidden items-center gap-2 mt-3">
                    {actions.map(({ key, title, Icon, cls, onClick }) => (
                      <button key={key} onClick={onClick} aria-label={title}
                        className={`flex-1 min-h-[44px] flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50 active:scale-95 transition-all ${cls}`}>
                        <Icon className="w-[18px] h-[18px]" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Назначение ролей — bottom-sheet на мобиле, диалог на десктопе */}
      {isRoleModalOpen && selectedUser && (() => {
        const userRoleIds = selectedUser.roles?.map(r => r.id) || [];
        const roleNames = selectedUser.roles?.map(r => r.name) || [];
        const needsSto = shouldShowStoCompany(roleNames);
        const needsParts = shouldShowPartsCompany(roleNames);
        const stoMissing = needsSto && !selectedUser.sto_company_id;
        const partsMissing = needsParts && !selectedUser.parts_company_id;
        const canSaveRoles = userRoleIds.length > 0 && !stoMissing && !partsMissing;

        const toggleRole = (role: Role) => {
          const current = selectedUser.roles || [];
          const exists = current.some(r => r.id === role.id);
          const newRoles = exists ? current.filter(r => r.id !== role.id) : [...current, role];
          // гарантируем, что есть основная роль
          if (newRoles.length > 0 && !newRoles.some(r => r.is_primary)) newRoles[0].is_primary = true;
          setSelectedUser({ ...selectedUser, roles: newRoles });
        };

        const closeRoleModal = () => { setIsRoleModalOpen(false); setSelectedUser(null); };

        return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] flex flex-col shadow-xl">
            {/* Хедер */}
            <div className="flex-shrink-0 px-5 pt-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <UserCog className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900">Роли и доступ</h2>
                  <p className="text-xs text-gray-400 truncate">{selectedUser.full_name || selectedUser.email}</p>
                </div>
              </div>
            </div>

            {/* Тело */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Роли — крупные тач-строки */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Роли</label>
                <div className="space-y-1.5">
                  {roles.map((role) => {
                    const checked = userRoleIds.includes(role.id);
                    return (
                      <button key={role.id} type="button" onClick={() => toggleRole(role)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.99] ${checked ? 'border-purple-300 bg-purple-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition-colors ${checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                          {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getRoleBadgeColor(role.name)}`}>
                          {role.display_name}
                        </span>
                        {role.description && <span className="text-xs text-gray-400 truncate flex-1">{role.description}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Основная роль */}
              {selectedUser.roles && selectedUser.roles.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Основная роль (вход в систему)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.roles.map(role => {
                      const active = (selectedUser.roles!.find(r => r.is_primary)?.id || selectedUser.roles![0]?.id) === role.id;
                      return (
                        <button key={role.id} type="button"
                          onClick={() => setSelectedUser({ ...selectedUser, roles: selectedUser.roles!.map(r => ({ ...r, is_primary: r.id === role.id })) })}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {role.display_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* СТО */}
              {needsSto && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">СТО *</label>
                  <select
                    value={selectedUser.sto_company_id || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, sto_company_id: e.target.value || null })}
                    className={`w-full px-3.5 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 ${stoMissing ? 'border-red-300' : 'border-gray-200 focus:border-purple-400'}`}
                  >
                    <option value="">Выберите СТО</option>
                    {stoCompanies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Разборка */}
              {needsParts && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Разборка *</label>
                  <select
                    value={selectedUser.parts_company_id || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, parts_company_id: e.target.value || null })}
                    className={`w-full px-3.5 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 ${partsMissing ? 'border-red-300' : 'border-gray-200 focus:border-purple-400'}`}
                  >
                    <option value="">Выберите разборку</option>
                    {partsCompanies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Футер */}
            <div className="flex-shrink-0 flex gap-2 px-5 py-4 border-t border-gray-100" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
              <button onClick={closeRoleModal}
                className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
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
                    sto_company_id: selectedUser.sto_company_id,
                    parts_company_id: selectedUser.parts_company_id
                  });
                }}
                className="flex-1 py-3 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Смена пароля</p>
                <p className="text-xs text-gray-400 truncate">{passwordModal.userName}</p>
              </div>
              <button onClick={closePasswordModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Новый пароль</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoFocus
                  placeholder="Минимум 6 символов"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">Минимум 6 символов</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={closePasswordModal}
                  className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  Отмена
                </button>
                <button
                  onClick={() => changePasswordMutation.mutate({ userId: passwordModal.userId, password: newPassword })}
                  disabled={newPassword.length < 6 || changePasswordMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {changePasswordMutation.isPending
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <KeyRound className="w-4 h-4" />}
                  {changePasswordMutation.isPending ? 'Сохранение...' : 'Сменить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
