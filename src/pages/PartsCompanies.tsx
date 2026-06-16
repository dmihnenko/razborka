import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Store, BarChart3, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
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
    queryKey: ['admin-parts-companies'],
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
      queryClient.invalidateQueries({ queryKey: ['admin-parts-companies'] });
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Разборка создана');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: Error & { message?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['admin-parts-companies'] });
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Разборка обновлена');
      setIsModalOpen(false);
      setSelectedCompany(null);
      resetForm();
    },
    onError: (error: Error & { message?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['admin-parts-companies'] });
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Разборка удалена');
    },
    onError: (error: Error & { message?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['admin-parts-companies'] });
      queryClient.invalidateQueries({ queryKey: ['parts_companies'] });
      toast.success('Статус разборки изменён');
    },
    onError: (error: Error & { message?: string }) => {
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
    const ok = await showConfirm({
      message: `Вы уверены, что хотите удалить разборку «${company.name}»? Это действие нельзя отменить.`,
      danger: true
    });
    if (!ok) return;
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
    setFormData({ name: '', address: '', phone: '', email: '', description: '' });
  };

  const filtered = companies.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.address ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  const isMutating =
    createMutation.isPending || updateMutation.isPending;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="page-header">
          <div className="h-7 w-36 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div className="card p-0 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0">
              <div className="icon-tile bg-gray-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-56 bg-gray-50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <p className="kicker mb-1">Администрирование</p>
          <h1 className="page-title">Разборки</h1>
          <p className="page-subtitle">
            Управление разборками и магазинами запчастей
            {companies.length > 0 && (
              <> · <span className="tabular">{companies.length}</span></>
            )}
          </p>
        </div>
        <button onClick={handleCreate} className="cab-btn cab-btn-primary">
          <Plus className="w-4 h-4" strokeWidth={2} />
          Создать разборку
        </button>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      {companies.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, адресу, телефону..."
            className="form-input pl-10"
          />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {companies.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Store className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
            </div>
            <p className="empty-state-title">Нет разборок</p>
            <p className="empty-state-text">Создайте первую разборку, чтобы начать работу</p>
            <button onClick={handleCreate} className="cab-btn cab-btn-primary mt-5">
              <Plus className="w-4 h-4" strokeWidth={2} />
              Создать разборку
            </button>
          </div>
        </div>
      )}

      {/* ── No search results ───────────────────────────────────────────── */}
      {companies.length > 0 && filtered.length === 0 && (
        <div className="card">
          <div className="empty-state py-10">
            <Search className="w-8 h-8 text-gray-300 mb-3" strokeWidth={1.5} />
            <p className="empty-state-title">Ничего не найдено</p>
            <p className="empty-state-text">Попробуйте изменить запрос поиска</p>
          </div>
        </div>
      )}

      {/* ── Desktop table (hidden on mobile) ────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="card p-0 overflow-hidden hidden sm:block">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header-cell w-10 rounded-tl-xl">#</th>
                <th className="table-header-cell">Разборка</th>
                <th className="table-header-cell">Контакты</th>
                <th className="table-header-cell">Статус</th>
                <th className="table-header-cell text-right rounded-tr-xl">Действия</th>
              </tr>
            </thead>
            <tbody className="grid-hairline">
              {filtered.map((company, idx) => (
                <tr key={company.id} className="table-row">
                  {/* # */}
                  <td className="table-cell">
                    <span className="kicker tabular">{idx + 1}</span>
                  </td>

                  {/* Name + description */}
                  <td className="table-cell">
                    <button
                      onClick={() => navigate(`/admin/parts-companies/${company.id}`)}
                      className="flex items-center gap-3 group text-left"
                      title="Открыть статистику"
                    >
                      <div className="icon-tile bg-blue-50 flex-shrink-0">
                        <Store className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
                          {company.name}
                        </p>
                        {company.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{company.description}</p>
                        )}
                        {company.address && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{company.address}</p>
                        )}
                      </div>
                    </button>
                  </td>

                  {/* Contacts */}
                  <td className="table-cell">
                    <div className="space-y-0.5">
                      {company.phone && (
                        <p className="text-sm text-gray-700 tabular">{company.phone}</p>
                      )}
                      {company.email && (
                        <p className="text-xs text-gray-400">{company.email}</p>
                      )}
                      {!company.phone && !company.email && (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="table-cell">
                    {company.is_active ? (
                      <span className="badge badge-green">Активна</span>
                    ) : (
                      <span className="badge badge-gray">Неактивна</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/admin/parts-companies/${company.id}`)}
                        className="btn-icon btn-icon-sm"
                        title="Статистика"
                      >
                        <BarChart3 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: company.id, isActive: company.is_active })}
                        className={`btn-sm font-semibold ${
                          company.is_active
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-green-600 hover:bg-green-50'
                        } rounded transition-colors`}
                        title={company.is_active ? 'Деактивировать' : 'Активировать'}
                      >
                        {company.is_active ? 'Деактивировать' : 'Активировать'}
                      </button>
                      <button
                        onClick={() => handleEdit(company)}
                        className="btn-icon btn-icon-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        title="Редактировать"
                      >
                        <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleDelete(company)}
                        className="btn-icon btn-icon-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile cards (hidden on desktop) ────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="sm:hidden space-y-3">
          {filtered.map(company => (
            <div key={company.id} className="card p-0 overflow-hidden">
              {/* Card header — clickable */}
              <button
                onClick={() => navigate(`/admin/parts-companies/${company.id}`)}
                className="flex items-start gap-3 w-full text-left px-4 pt-4 pb-3 group"
              >
                <div className="icon-tile bg-blue-50 flex-shrink-0">
                  <Store className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
                      {company.name}
                    </p>
                    {company.is_active ? (
                      <span className="badge badge-green flex-shrink-0">Активна</span>
                    ) : (
                      <span className="badge badge-gray flex-shrink-0">Неактивна</span>
                    )}
                  </div>
                  {company.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{company.description}</p>
                  )}
                </div>
                <BarChart3 className="w-4 h-4 text-gray-300 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" strokeWidth={1.5} />
              </button>

              {/* Details */}
              {(company.address || company.phone || company.email) && (
                <div className="px-4 pb-3 space-y-1">
                  {company.address && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-600">Адрес:</span> {company.address}
                    </p>
                  )}
                  {company.phone && (
                    <p className="text-xs text-gray-500 tabular">
                      <span className="font-semibold text-gray-600">Тел:</span> {company.phone}
                    </p>
                  )}
                  {company.email && (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-600">Email:</span> {company.email}
                    </p>
                  )}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => toggleActiveMutation.mutate({ id: company.id, isActive: company.is_active })}
                  className={`text-xs font-semibold ${
                    company.is_active
                      ? 'text-amber-600 hover:text-amber-700'
                      : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  {company.is_active ? 'Деактивировать' : 'Активировать'}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(company)}
                    className="btn-icon btn-icon-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                    title="Редактировать"
                  >
                    <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => handleDelete(company)}
                    className="btn-icon btn-icon-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal (top-sheet mobile / center desktop) ─────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-start sm:items-center justify-center z-50 px-3 py-3 sm:p-4"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
          onClick={e => { if (e.target === e.currentTarget) { setIsModalOpen(false); setSelectedCompany(null); resetForm(); } }}
        >
          <div className="w-full sm:max-w-md bg-white rounded-2xl shadow-2xl animate-modal-pop">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100">
              <div>
                <p className="kicker mb-0.5">
                  {selectedCompany ? 'Редактирование' : 'Новая разборка'}
                </p>
                <h2 className="heading-3">
                  {selectedCompany ? selectedCompany.name : 'Создать разборку'}
                </h2>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[60vh] sm:max-h-none">
              <div>
                <label className="form-label">Название <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                  placeholder="Например: Разборка Автозапчасти"
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">Адрес</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="form-input"
                  placeholder="г. Киев, ул. Примерная, 123"
                />
              </div>
              <div>
                <label className="form-label">Телефон</label>
                <IMaskInput
                  mask="+380 00 000-00-00"
                  value={formData.phone}
                  onAccept={value => setFormData({ ...formData, phone: value })}
                  type="tel"
                  className="form-input"
                  placeholder="+380 XX XXX-XX-XX"
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="form-input"
                  placeholder="info@example.com"
                />
              </div>
              <div>
                <label className="form-label">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="form-input resize-none"
                  rows={3}
                  placeholder="Краткое описание разборки..."
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={() => { setIsModalOpen(false); setSelectedCompany(null); resetForm(); }}
                className="cab-btn cab-btn-secondary flex-1"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim() || isMutating}
                className="cab-btn cab-btn-primary flex-1"
              >
                {isMutating ? 'Сохранение…' : selectedCompany ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
