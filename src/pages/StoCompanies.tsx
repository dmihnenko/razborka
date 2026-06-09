import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Building2, Users, CreditCard, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  fetchStoCompanies,
  createStoCompany,
  updateStoCompany,
  deleteStoCompany,
  toggleStoCompanyActive,
  type StoCompany,
  type StoFormData,
} from '@/services/stoService';

export default function StoCompanies() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSto, setSelectedSto] = useState<StoCompany | null>(null);
  const [formData, setFormData] = useState<StoFormData>({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: ''
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm: showConfirm, dialogProps } = useConfirm();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['sto_companies'],
    queryFn: fetchStoCompanies,
  });

  const createMutation = useMutation({
    mutationFn: (data: StoFormData) => createStoCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_companies'] });
      toast.success('СТО создано');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при создании СТО');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoFormData }) => updateStoCompany(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_companies'] });
      toast.success('СТО обновлено');
      setIsModalOpen(false);
      setSelectedSto(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при обновлении СТО');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStoCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_companies'] });
      toast.success('СТО удалено');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при удалении СТО');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleStoCompanyActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_companies'] });
      toast.success('Статус СТО изменен');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при изменении статуса');
    }
  });

  const handleCreate = () => {
    resetForm();
    setSelectedSto(null);
    setIsModalOpen(true);
  };

  const handleEdit = (sto: StoCompany) => {
    setSelectedSto(sto);
    setFormData({
      name: sto.name,
      address: sto.address || '',
      phone: sto.phone || '',
      email: sto.email || '',
      description: sto.description || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (sto: StoCompany) => {
    const ok = await showConfirm({ message: `Вы уверены, что хотите удалить СТО "${sto.name}"? Это действие нельзя отменить.`, danger: true })
    if (!ok) return
    deleteMutation.mutate(sto.id);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Введите название СТО');
      return;
    }

    if (selectedSto) {
      updateMutation.mutate({ id: selectedSto.id, data: formData });
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
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">СТО</h1>
          <p className="text-sm text-gray-600 mt-1">Управление станциями технического обслуживания</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Создать СТО</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((sto) => (
          <div
            key={sto.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <button
              onClick={() => navigate(`/admin/sto/${sto.id}`)}
              className="flex items-start justify-between mb-4 w-full text-left group"
              title="Открыть статистику"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">{sto.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    sto.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {sto.is_active ? 'Активно' : 'Неактивно'}
                  </span>
                </div>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors flex-shrink-0" />
            </button>

            <div className="space-y-2 mb-4 text-sm text-gray-600">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Работников: {sto.workers_count || 0}</span>
                </div>
                {sto.subscription ? (
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">
                      {sto.subscription.type === 'lifetime' ? 'Бессрочная' : 'Месячная'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-orange-600 font-medium">Без подписки</span>
                )}
              </div>
              
              {sto.address && (
                <div className="flex items-start">
                  <span className="font-medium mr-2">Адрес:</span>
                  <span>{sto.address}</span>
                </div>
              )}
              {sto.phone && (
                <div className="flex items-center">
                  <span className="font-medium mr-2">Телефон:</span>
                  <span>{sto.phone}</span>
                </div>
              )}
              {sto.email && (
                <div className="flex items-center">
                  <span className="font-medium mr-2">Email:</span>
                  <span>{sto.email}</span>
                </div>
              )}
              {sto.description && (
                <div className="flex items-start">
                  <span className="font-medium mr-2">Описание:</span>
                  <span className="text-gray-500">{sto.description}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleActiveMutation.mutate({ id: sto.id, isActive: sto.is_active })}
                  className={`text-sm font-medium ${
                    sto.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  {sto.is_active ? 'Деактивировать' : 'Активировать'}
                </button>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(sto)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="Редактировать"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(sto)}
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
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Нет созданных СТО</p>
            <p className="text-sm mt-2">Нажмите "Создать СТО" чтобы добавить первую станцию</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {selectedSto ? 'Редактировать СТО' : 'Создать СТО'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название СТО *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Например: СТО Автосервис"
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
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  placeholder="Краткое описание СТО..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedSto(null);
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
                {selectedSto ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
