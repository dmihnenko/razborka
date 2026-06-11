import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Store, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { IMaskInput } from 'react-imask';
import { useConfirm } from '@/hooks/useConfirm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PartsCompany {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  workers_count?: number;
  subscription?: {
    id: string;
    type: string;
    end_date: string | null;
  };
}

interface PartsFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  description: string;
}

export default function PartsCompanies() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<PartsCompany | null>(null);
  const [formData, setFormData] = useState<PartsFormData>({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: ''
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm: showConfirm, dialogProps } = useConfirm();

  // Загрузка разборок
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['parts_companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PartsCompany[];
    }
  });

  // Создание разборки
  const createMutation = useMutation({
    mutationFn: async (data: PartsFormData) => {
      const { error } = await supabase
        .from('parts_companies')
        .insert({
          name: data.name,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          description: data.description || null,
          is_active: true
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Разборка создана');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при создании разборки');
    }
  });

  // Обновление разборки
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PartsFormData }) => {
      const { error } = await supabase
        .from('parts_companies')
        .update({
          name: data.name,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          description: data.description || null
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Разборка обновлена');
      setIsModalOpen(false);
      setSelectedCompany(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при обновлении разборки');
    }
  });

  // Удаление разборки
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('parts_companies')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Разборка удалена');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при удалении разборки');
    }
  });

  // Переключение активности
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('parts_companies')
        .update({ is_active: !isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Статус разборки изменен');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при изменении статуса');
    }
  });

  const handleCreate = () => {
    resetForm();
    setSelectedCompany(null);
    setIsModalOpen(true);
  };

  const handleEdit = (company: PartsCompany) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      description: company.description || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (company: PartsCompany) => {
    const ok = await showConfirm({ message: `Вы уверены, что хотите удалить разборку "${company.name}"? Это действие нельзя отменить.`, danger: true })
    if (!ok) return
    deleteMutation.mutate(company.id);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Введите название разборки');
      return;
    }

    if (selectedCompany) {
      updateMutation.mutate({ id: selectedCompany.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      email: '',
      description: ''
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Разборки</h1>
          <p className="text-sm text-gray-600 mt-1">Управление разборками и магазинами запчастей</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Создать разборку</span>
        </button>
      </div>

      {companies.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center text-gray-400">
          <Store className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Нет разборок</p>
          <button onClick={handleCreate} className="mt-3 text-sm text-purple-600 font-semibold hover:underline">Создать первую</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div
            key={company.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <button
              onClick={() => navigate(`/admin/parts-companies/${company.id}`)}
              className="flex items-start justify-between mb-4 w-full text-left group"
              title="Открыть статистику"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Store className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">{company.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    company.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {company.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                </div>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-300 group-hover:text-orange-500 transition-colors flex-shrink-0" />
            </button>

            <div className="space-y-2 mb-4 text-sm text-gray-600">
              {company.address && (
                <div className="flex items-start">
                  <span className="font-medium mr-2">Адрес:</span>
                  <span>{company.address}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center">
                  <span className="font-medium mr-2">Телефон:</span>
                  <span>{company.phone}</span>
                </div>
              )}
              {company.email && (
                <div className="flex items-center">
                  <span className="font-medium mr-2">Email:</span>
                  <span>{company.email}</span>
                </div>
              )}
              {company.description && (
                <div className="flex items-start">
                  <span className="font-medium mr-2">Описание:</span>
                  <span className="text-gray-500">{company.description}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <button
                onClick={() => toggleActiveMutation.mutate({ id: company.id, isActive: company.is_active })}
                className={`text-sm font-medium ${
                  company.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'
                }`}
              >
                {company.is_active ? 'Деактивировать' : 'Активировать'}
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(company)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="Редактировать"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(company)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {companies.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Store className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Нет созданных разборок</p>
            <p className="text-sm mt-2">Нажмите "Создать разборку" чтобы добавить первую</p>
          </div>
        )}
      </div>

      {/* Модальное окно */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {selectedCompany ? 'Редактировать разборку' : 'Создать разборку'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название разборки *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Например: Разборка Автозапчасти"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Адрес
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="г. Киев, ул. Примерная, 123"
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
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="+380 XX XXX-XX-XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="info@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Краткое описание разборки..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedCompany(null);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-700 rounded-md hover:bg-purple-800 disabled:bg-gray-400"
              >
                {selectedCompany ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
