import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, UserCog, Search, CheckCircle2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { IMaskInput } from 'react-imask';
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

interface StoCompany {
  id: string;
  name: string;
}

interface PartsCompany {
  id: string;
  name: string;
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

interface UserFormData {
  email: string;
  username: string;
  password: string;
  full_name: string;
  phone: string;
  role_ids: string[]; // Изменено на массив
  primary_role_id: string; // Основная роль
  sto_company_id: string;
  parts_company_id: string;
}

export default function Users() {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordModal, setPasswordModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    username: '',
    password: '',
    full_name: '',
    phone: '',
    role_ids: [], // Изменено на массив
    primary_role_id: '', // Основная роль
    sto_company_id: '',
    parts_company_id: ''
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm: showConfirm, dialogProps } = useConfirm();
  
  // Получаем информацию о текущем пользователе
  const isAdmin = useIsAdmin();
  const { data: currentUserProfile } = useUserProfile();
  const { hasSubscription, canCreate, limits } = useSubscriptionLimits();
  
  // Определяем роль текущего пользователя
  const isStoOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'sto_owner');
  const isPartsOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'parts_owner');

  // Загрузка пользователей
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', currentUserProfile?.id, isStoOwner, isPartsOwner],
    queryFn: async () => {
      let query = supabase
        .from('user_profiles')
        .select(`
          *,
          sto_companies:sto_company_id(id, name),
          parts_companies:parts_company_id(id, name)
        `);
      
      // Если владелец СТО - показываем только работников его СТО
      if (isStoOwner && !isAdmin) {
        query = query.eq('sto_company_id', currentUserProfile?.sto_company_id);
      }
      
      // Если владелец разборки - показываем только работников его разборки
      if (isPartsOwner && !isAdmin && !isStoOwner) {
        query = query.eq('parts_company_id', currentUserProfile?.parts_company_id);
      }
      
      const { data: profiles, error: profilesError } = await query;

      if (profilesError) throw profilesError;

      // Получаем все роли
      const { data: allRoles, error: rolesError } = await supabase
        .from('roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Получаем все связи пользователь-роль
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (userRolesError) throw userRolesError;

      // Объединяем данные - для каждого пользователя получаем его роли
      const profilesWithRoles = profiles?.map(profile => {
        const userRoleIds = userRolesData?.filter(ur => ur.user_id === profile.id).map(ur => ur.role_id) || [];
        const userRoles = allRoles?.filter(r => userRoleIds.includes(r.id)) || [];
        return {
          ...profile,
          roles: userRoles,
          email: profile.email || 'N/A'
        };
      }) || [];

      return profilesWithRoles;
    }
  });

  // Загрузка ролей
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      if (error) throw error;
      return data as Role[];
    }
  });

  // Загрузка СТО
  const { data: stoCompanies = [] } = useQuery({
    queryKey: ['sto_companies'],
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sto_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as StoCompany[];
    }
  });

  // Загрузка разборок
  const selectedRoleNames = useMemo(
    () => roles.filter(r => formData.role_ids.includes(r.id)).map(r => r.name),
    [formData.role_ids, roles]
  );

  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts_companies'],
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as PartsCompany[];
    }
  });

  // Обновление ролей пользователя
  const updateUserRolesMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      roleIds, 
      primaryRoleId,
      sto_company_id,
      parts_company_id
    }: { 
      userId: string; 
      roleIds: string[]; 
      primaryRoleId?: string;
      sto_company_id?: string | null;
      parts_company_id?: string | null;
    }) => {
      // Удаляем все старые роли
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;

      // Добавляем новые роли
      if (roleIds.length > 0) {
        const userRoles = roleIds.map(roleId => ({
          user_id: userId,
          role_id: roleId,
          is_primary: roleId === primaryRoleId // Помечаем основную роль
        }));

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(userRoles);
        
        if (insertError) throw insertError;
      }

      // Обновляем привязки к организациям
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          sto_company_id: sto_company_id || null,
          parts_company_id: parts_company_id || null
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    },
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
  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
      full_name: '',
      phone: '',
      role_ids: [],
      primary_role_id: '',
      sto_company_id: '',
      parts_company_id: ''
    });
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      // Проверка лимитов для владельцев
      if ((isStoOwner || isPartsOwner) && !isAdmin) {
        const currentWorkers = users.filter(u => 
          u.sto_company_id === currentUserProfile?.sto_company_id ||
          u.parts_company_id === currentUserProfile?.parts_company_id
        ).length;
        
        if (!canCreate.worker(currentWorkers)) {
          const limit = isStoOwner ? limits.sto?.workers : limits.parts?.workers;
          throw new Error(`Достигнут лимит работников (${limit}). Оформите подписку для добавления дополнительных сотрудников.`);
        }
      }
      
      // Создаём пользователя через Edge Function — не затрагивает текущую сессию
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email || null,
          password: data.password,
          full_name: data.full_name,
          phone: data.phone,
          username: data.username.toLowerCase(),
          role_ids: data.role_ids,
          primary_role_id: data.primary_role_id,
          sto_company_id: data.sto_company_id || null,
          parts_company_id: data.parts_company_id || null,
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (fnData?.error) throw new Error(fnData.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentUserProfile?.id, isStoOwner, isPartsOwner] });
      toast.success('Пользователь создан');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при создании пользователя');
      console.error(error);
    }
  });

  // Обновление данных пользователя
  const updateUserDataMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<UserFormData> }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          sto_company_id: data.sto_company_id || null,
          parts_company_id: data.parts_company_id || null
        })
        .eq('id', userId);
      
      if (error) throw error;

      // Обновляем роли через таблицу user_roles
      if (data.role_ids) {
        // Удаляем старые роли
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        if (deleteError) throw deleteError;

        // Добавляем новые роли
        if (data.role_ids.length > 0) {
          const userRoles = data.role_ids.map(roleId => ({
            user_id: userId,
            role_id: roleId,
            is_primary: roleId === data.primary_role_id // Помечаем основную роль
          }));

          const { error: insertError } = await supabase
            .from('user_roles')
            .insert(userRoles);
          
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentUserProfile?.id, isStoOwner, isPartsOwner] });
      queryClient.invalidateQueries({ queryKey: ['user_profile'] });
      toast.success('Данные пользователя обновлены');
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error('Ошибка при обновлении данных');
      console.error(error);
    }
  });

  // Переключение активности пользователя
  const toggleActiveMutation = useMutation({
    mutationFn: async (user: UserProfile) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentUserProfile?.id, isStoOwner, isPartsOwner] });
      toast.success('Статус пользователя изменен');
    },
    onError: (error) => {
      toast.error('Ошибка при изменении статуса');
      console.error(error);
    }
  });

  // Удаление пользователя — мягкое (деактивация) + удаление из auth через Edge Function
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Деактивируем профиль (мягкое удаление)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Удаляем из auth.users через Edge Function
      const { data: { session } } = await supabase.auth.getSession()
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', currentUserProfile?.id, isStoOwner, isPartsOwner] });
      toast.success('Пользователь удалён');
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении: ${error.message || 'Неизвестная ошибка'}`);
      console.error(error);
    }
  });

  // Смена пароля пользователя (admin/owner)
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
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
      queryClient.invalidateQueries({ queryKey: ['users', currentUserProfile?.id, isStoOwner, isPartsOwner] });
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
    const ok = await showConfirm({ message: `Вы уверены, что хотите удалить пользователя ${user.full_name || user.email}? Это действие нельзя отменить.`, danger: true });
    if (!ok) return;
    deleteUserMutation.mutate(user.id);
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

  const filteredUsers = useMemo(
    () => users.filter(user => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q) ||
        user.username?.toLowerCase().includes(q) ||
        user.phone?.includes(q)
      );
    }),
    [users, searchQuery]
  );

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
          <p className="text-xs text-gray-400 mt-0.5">{users.length} {users.length === 1 ? 'запись' : users.length < 5 ? 'записи' : 'записей'}</p>
        </div>
        <button onClick={handleCreateUser}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{isAdmin ? 'Добавить пользователя' : 'Добавить сотрудника'}</span>
          <span className="sm:hidden">Добавить</span>
        </button>
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск по имени, email, логину..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 shadow-sm transition-all"
        />
      </div>

      {/* Список пользователей */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserCog className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">{searchQuery ? 'Ничего не найдено' : 'Нет пользователей'}</p>
            {searchQuery && <p className="text-xs mt-1 opacity-70">Попробуйте изменить запрос</p>}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 sm:gap-4 px-4 py-3.5 hover:bg-gray-50/80 transition-colors group">
                {/* Аватар */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                  {(user.full_name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                </div>

                {/* Основная инфо */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {user.full_name || <span className="text-gray-400 font-normal">Имя не указано</span>}
                    </span>
                    <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {user.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
                  {(isStoOwner || isPartsOwner) && !isAdmin && user.username && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">@{user.username}</p>
                  )}
                </div>

                {/* Роли — только основная + счётчик остальных */}
                <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                  {user.roles && user.roles.length > 0 ? (() => {
                    const primary = user.roles.find((r: Role) => r.is_primary) || user.roles[0]
                    const rest = user.roles.length - 1
                    return (
                      <>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${getRoleBadgeColor(primary.name)}`}>
                          {primary.display_name}
                        </span>
                        {rest > 0 && (
                          <span title={user.roles.slice(1).map((r: Role) => r.display_name).join(', ')}
                            className="text-[11px] text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded-lg cursor-default whitespace-nowrap">
                            +{rest}
                          </span>
                        )}
                      </>
                    )
                  })() : (
                    <span className="text-[11px] text-gray-400 italic whitespace-nowrap">Без роли</span>
                  )}
                </div>

                {/* Компания */}
                <div className="hidden md:block text-xs text-gray-500 min-w-[80px] text-right">
                  {user.sto_companies?.name || user.parts_companies?.name || <span className="text-gray-300">—</span>}
                </div>

                {/* Действия */}
                <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEditUser(user)}
                    title="Редактировать"
                    className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {(isAdmin || isStoOwner || isPartsOwner) && (
                    <button onClick={() => { setPasswordModal({ userId: user.id, userName: user.full_name || user.username || user.email }); setNewPassword(''); }}
                      title="Сменить пароль"
                      className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors">
                      <KeyRound className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleEditRole(user)}
                      title="Роли"
                      className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors">
                      <UserCog className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && !user.is_active && (
                    <button onClick={() => handleToggleActive(user)}
                      title="Активировать"
                      className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleDeleteUser(user)}
                      title="Удалить"
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно для создания пользователя */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Изменить роли пользователя</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                Пользователь: <span className="font-medium">{selectedUser.full_name || selectedUser.email}</span>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Роли (можно выбрать несколько)
              </label>
              <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                {roles.map((role) => {
                  const userRoleIds = selectedUser.roles?.map(r => r.id) || [];
                  return (
                    <label key={role.id} className="flex items-center py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userRoleIds.includes(role.id)}
                        onChange={(e) => {
                          const currentRoles = selectedUser.roles || [];
                          let newRoles;
                          if (e.target.checked) {
                            newRoles = [...currentRoles, role];
                          } else {
                            newRoles = currentRoles.filter(r => r.id !== role.id);
                          }
                          setSelectedUser({ ...selectedUser, roles: newRoles });
                        }}
                        className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className={`text-sm px-2 py-1 rounded-full ${getRoleBadgeColor(role.name)}`}>
                        {role.display_name}
                      </span>
                    </label>
                  );
                })}
              </div>
              {selectedUser.roles && selectedUser.roles.length > 1 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Основная роль (для входа в систему)
                  </label>
                  <select
                    value={selectedUser.roles.find(r => r.is_primary)?.id || selectedUser.roles[0]?.id || ''}
                    onChange={(e) => {
                      const newRoles = selectedUser.roles?.map(r => ({
                        ...r,
                        is_primary: r.id === e.target.value
                      })) || [];
                      setSelectedUser({ ...selectedUser, roles: newRoles });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {selectedUser.roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Привязка к СТО */}
              {shouldShowStoCompany(selectedUser.roles?.map(r => r.name) || []) && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    СТО {selectedUser.roles?.some(r => r.name === 'sto_owner' || r.name === 'sto_worker') ? '*' : ''}
                  </label>
                  <select
                    value={selectedUser.sto_company_id || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, sto_company_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Выберите СТО</option>
                    {stoCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Привязка к разборке */}
              {shouldShowPartsCompany(selectedUser.roles?.map(r => r.name) || []) && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Разборка {selectedUser.roles?.some(r => r.name === 'parts_owner' || r.name === 'parts_worker') ? '*' : ''}
                  </label>
                  <select
                    value={selectedUser.parts_company_id || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, parts_company_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Выберите разборку</option>
                    {partsCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsRoleModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  const roleIds = selectedUser.roles?.map(r => r.id) || [];
                  const primaryRoleId = selectedUser.roles?.find(r => r.is_primary)?.id || roleIds[0];
                  updateUserRolesMutation.mutate({
                    userId: selectedUser.id,
                    roleIds: roleIds,
                    primaryRoleId: primaryRoleId,
                    sto_company_id: selectedUser.sto_company_id,
                    parts_company_id: selectedUser.parts_company_id
                  });
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-700 rounded-md hover:bg-purple-800"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
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
              <button onClick={() => setPasswordModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
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
                <button onClick={() => setPasswordModal(null)}
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
