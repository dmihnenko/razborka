import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { IMaskInput } from 'react-imask';
import { useUserProfile, useIsAdmin } from '@/hooks/useUserProfile';
import { useSubscriptionLimits } from '@/hooks/useSubscription';

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
  plain_password: string | null;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  const queryClient = useQueryClient();
  
  // Получаем информацию о текущем пользователе
  const isAdmin = useIsAdmin();
  const { data: currentUserProfile } = useUserProfile();
  const { hasSubscription, canCreate, limits } = useSubscriptionLimits();
  
  // Определяем роль текущего пользователя
  const isStoOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'sto_owner');
  const isPartsOwner = currentUserProfile?.roles?.some((r: Role) => r.name === 'parts_owner');

  // Загрузка пользователей
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
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
  const { data: partsCompanies = [] } = useQuery({
    queryKey: ['parts_companies'],
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
      
      // Генерируем email-заглушку если не указан email
      const email = data.email || `${data.username}@example.com`;

      // Используем стандартную регистрацию Supabase
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            phone: data.phone,
            username: data.username,
            plain_password: data.password,
            primary_role_id: data.primary_role_id,
            sto_company_id: data.sto_company_id || null,
            parts_company_id: data.parts_company_id || null,
            is_active: true
          }
        }
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (!authData.user) {
        throw new Error('Не удалось создать пользователя');
      }

      // Добавляем роли пользователю
      const roleInserts = data.role_ids.map(roleId => ({
        user_id: authData.user!.id,
        role_id: roleId
      }));

      const { error: rolesError } = await supabase
        .from('user_roles')
        .insert(roleInserts);

      if (rolesError) {
        throw new Error('Ошибка при добавлении ролей: ' + rolesError.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Пользователь создан');
      setIsCreateModalOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Данные пользователя обновлены');
      setIsEditModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error('Ошибка при обновлении данных');
      console.error(error);
    }
  });

  // Переключение активности пользователя
  const toggleActiveMutation = useMutation({
    mutationFn: async (user: User) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Статус пользователя изменен');
    },
    onError: (error) => {
      toast.error('Ошибка при изменении статуса');
      console.error(error);
    }
  });

  // Удаление пользователя
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Удаляем роли пользователя
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      // Удаляем профиль пользователя
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Примечание: удаление из auth.users нужно делать через Supabase Dashboard
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Пользователь удален из базы данных. Удалите его из Authentication через Dashboard.');
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении пользователя: ${error.message || 'Неизвестная ошибка'}`);
      console.error(error);
    }
  });

  const handleToggleActive = (user: User) => {
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
    setSelectedUser(user);
    const userRoleIds = user.roles?.map(r => r.id) || [];
    const primaryRole = user.roles?.find(r => r.is_primary);
    setFormData({
      email: user.email,
      username: '',
      password: '',
      full_name: user.full_name || '',
      phone: user.phone || '',
      role_ids: userRoleIds,
      primary_role_id: primaryRole?.id || (userRoleIds[0] || ''), // Берем первую роль как основную, если не указано
      sto_company_id: user.sto_company_id || '',
      parts_company_id: user.parts_company_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleCreateUser = () => {
    resetForm();
    
    // Для владельца СТО автоматически заполняем данные
    if (isStoOwner && !isAdmin) {
      setFormData(prev => ({
        ...prev,
        sto_company_id: currentUserProfile?.sto_company_id || '',
        role_ids: [], // Можно будет выбрать только sto_worker
      }));
    }
    
    // Для владельца разборки автоматически заполняем данные
    if (isPartsOwner && !isAdmin) {
      setFormData(prev => ({
        ...prev,
        parts_company_id: currentUserProfile?.parts_company_id || '',
        role_ids: [], // Можно будет выбрать только parts_worker
      }));
    }
    
    setIsCreateModalOpen(true);
  };

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
    setSelectedRoleNames([]);
  };

  const handleDeleteUser = (user: UserProfile) => {
    const hasAdminRole = user.roles?.some(r => r.name === 'admin');
    if (hasAdminRole) {
      toast.error('Невозможно удалить администратора');
      return;
    }
    
    if (confirm(`Вы уверены, что хотите удалить пользователя ${user.full_name || user.email}? Это действие нельзя отменить.`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  // Отслеживание изменения ролей
  useEffect(() => {
    if (roles.length === 0) return
    const selectedRoles = roles.filter(r => formData.role_ids.includes(r.id));
    setSelectedRoleNames(selectedRoles.map(r => r.name));
  }, [formData.role_ids, roles]);

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
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Информация о подписке для владельцев */}
      {(isStoOwner || isPartsOwner) && !isAdmin && (
        <div className={`p-4 rounded-lg ${hasSubscription ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900">
                {hasSubscription ? '✓ Активная подписка' : '⚠ Без подписки'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {hasSubscription 
                  ? 'У вас есть активная подписка. Доступны все функции без ограничений.' 
                  : `Ограничения: ${isStoOwner 
                      ? `${limits.sto?.workers} работник, ${limits.sto?.appointments} заявок, ${limits.sto?.customers} клиента, ${limits.sto?.vehicles} машины` 
                      : `${limits.parts?.workers} работник, ${limits.parts?.vehicles} машина, ${limits.parts?.parts} запчастей`}`
                }
              </p>
              {!hasSubscription && (
                <p className="text-sm text-purple-600 mt-2">
                  Свяжитесь с администратором для активации подписки
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-500">
                Сотрудников: {users.length} / {hasSubscription ? '∞' : (isStoOwner ? limits.sto?.workers : limits.parts?.workers)}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? 'Пользователи' : isStoOwner ? 'Сотрудники СТО' : isPartsOwner ? 'Сотрудники разборки' : 'Пользователи'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {isAdmin ? 'Управление пользователями и их ролями' : 'Управление сотрудниками'}
          </p>
        </div>
        <button
          onClick={handleCreateUser}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="h-5 w-5" />
          <span>{isAdmin ? 'Добавить пользователя' : 'Добавить сотрудника'}</span>
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Пользователь
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              {(isStoOwner || isPartsOwner) && !isAdmin && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Логин
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Пароль
                  </th>
                </>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Телефон
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Роль
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Компания
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.full_name || 'Не указано'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.email}</div>
                </td>
                {(isStoOwner || isPartsOwner) && !isAdmin && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">{user.username || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">{user.plain_password || '—'}</div>
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.phone || '—'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles && user.roles.length > 0 ? (
                      user.roles.map((role: Role) => (
                        <span key={role.id} className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(role.name)}`}>
                          {role.display_name}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Не назначены
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {user.sto_companies?.name || user.parts_companies?.name || '—'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Редактировать"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleEditRole(user)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Изменить роли"
                        >
                          <UserCog className="h-5 w-5" />
                        </button>
                        {!user.is_active && (
                          <button
                            onClick={() => handleToggleActive(user)}
                            className="text-green-600 hover:text-green-900"
                            title="Активировать"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                    {(isAdmin || (!user.roles?.some((r: Role) => r.name === 'admin'))) && (
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="text-red-600 hover:text-red-900"
                        title="Удалить"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модальное окно для создания пользователя */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Создать пользователя</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="user@example.com (опционально)"
                />
                <p className="text-xs text-gray-500 mt-1">Если не указан, будет использована заглушка</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Логин (username) *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="username"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Пользователь войдет по этому логину</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Пароль *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Минимум 6 символов"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ФИО
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Телефон
                </label>
                <IMaskInput
                  mask="+380 00 000-00-00"
                  value={formData.phone}
                  onAccept={(value) => setFormData({ ...formData, phone: value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="+380 XX XXX-XX-XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Роли (можно выбрать несколько)
                </label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  {roles
                    .filter(role => {
                      // Админ видит все роли КРОМЕ sto_worker и parts_worker (их создают владельцы)
                      if (isAdmin) return role.name !== 'sto_worker' && role.name !== 'parts_worker';
                      // Владелец СТО видит только sto_worker
                      if (isStoOwner) return role.name === 'sto_worker';
                      // Владелец разборки видит только parts_worker
                      if (isPartsOwner) return role.name === 'parts_worker';
                      return true;
                    })
                    .map((role) => (
                    <label key={role.id} className="flex items-center py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.role_ids.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newRoleIds = [...formData.role_ids, role.id];
                            setFormData({ 
                              ...formData, 
                              role_ids: newRoleIds,
                              // Если это первая роль, делаем её основной
                              primary_role_id: formData.primary_role_id || role.id
                            });
                          } else {
                            const newRoleIds = formData.role_ids.filter(id => id !== role.id);
                            setFormData({ 
                              ...formData, 
                              role_ids: newRoleIds,
                              // Если убрали основную роль, берём первую из оставшихся
                              primary_role_id: formData.primary_role_id === role.id 
                                ? (newRoleIds[0] || '') 
                                : formData.primary_role_id
                            });
                          }
                        }}
                        className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className={`text-sm px-2 py-1 rounded-full ${getRoleBadgeColor(role.name)}`}>
                        {role.display_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {formData.role_ids.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Основная роль (для входа в систему)
                  </label>
                  <select
                    value={formData.primary_role_id}
                    onChange={(e) => setFormData({ ...formData, primary_role_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {formData.role_ids.map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <option key={role.id} value={role.id}>
                          {role.display_name}
                        </option>
                      ) : null;
                    })}
                  </select>
                </div>
              )}
              {shouldShowStoCompany(selectedRoleNames) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    СТО {selectedRoleNames.some(name => name === 'sto_owner' || name === 'sto_worker') ? '*' : ''}
                  </label>
                  <select
                    value={formData.sto_company_id}
                    onChange={(e) => setFormData({ ...formData, sto_company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isStoOwner && !isAdmin}
                  >
                    <option value="">Выберите СТО</option>
                    {stoCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {isStoOwner && !isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">Автоматически привязан к вашей СТО</p>
                  )}
                </div>
              )}
              {shouldShowPartsCompany(selectedRoleNames) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Разборка {selectedRoleNames.some(name => name === 'parts_owner' || name === 'parts_worker') ? '*' : ''}
                  </label>
                  <select
                    value={formData.parts_company_id}
                    onChange={(e) => setFormData({ ...formData, parts_company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isPartsOwner && !isAdmin}
                  >
                    <option value="">Выберите разборку</option>
                    {partsCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {isPartsOwner && !isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">Автоматически привязан к вашей разборке</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={() => createUserMutation.mutate(formData)}
                disabled={!formData.email || !formData.password || formData.password.length < 6}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для редактирования пользователя */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Редактировать пользователя</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email нельзя изменить</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ФИО
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Телефон
                </label>
                <IMaskInput
                  mask="+380 00 000-00-00"
                  value={formData.phone}
                  onAccept={(value) => setFormData({ ...formData, phone: value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+380 XX XXX-XX-XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Роли (можно выбрать несколько)
                </label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.role_ids.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newRoleIds = [...formData.role_ids, role.id];
                            setFormData({ 
                              ...formData, 
                              role_ids: newRoleIds,
                              primary_role_id: formData.primary_role_id || role.id
                            });
                          } else {
                            const newRoleIds = formData.role_ids.filter(id => id !== role.id);
                            setFormData({ 
                              ...formData, 
                              role_ids: newRoleIds,
                              primary_role_id: formData.primary_role_id === role.id 
                                ? (newRoleIds[0] || '') 
                                : formData.primary_role_id
                            });
                          }
                        }}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className={`text-sm px-2 py-1 rounded-full ${getRoleBadgeColor(role.name)}`}>
                        {role.display_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {formData.role_ids.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Основная роль (для входа в систему)
                  </label>
                  <select
                    value={formData.primary_role_id}
                    onChange={(e) => setFormData({ ...formData, primary_role_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {formData.role_ids.map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <option key={role.id} value={role.id}>
                          {role.display_name}
                        </option>
                      ) : null;
                    })}
                  </select>
                </div>
              )}
              {shouldShowStoCompany(selectedRoleNames) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    СТО
                  </label>
                  <select
                    value={formData.sto_company_id}
                    onChange={(e) => setFormData({ ...formData, sto_company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {shouldShowPartsCompany(selectedRoleNames) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Разборка
                  </label>
                  <select
                    value={formData.parts_company_id}
                    onChange={(e) => setFormData({ ...formData, parts_company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={() => updateUserDataMutation.mutate({
                  userId: selectedUser.id,
                  data: formData
                })}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для изменения ролей */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Изменить роли пользователя</h2>
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
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
