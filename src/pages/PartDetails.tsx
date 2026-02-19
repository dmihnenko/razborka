import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PartCatalogItem } from '../types/partsCatalog';
import { ArrowLeft, Phone, MapPin, Clock, Mail, Share2, Heart, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PartDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const queryClient = useQueryClient();

  // Загрузка данных запчасти
  const { data: part, isLoading } = useQuery({
    queryKey: ['part-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_catalog')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as PartCatalogItem;
    },
    enabled: !!id
  });

  // Увеличение счетчика просмотров
  useMutation({
    mutationFn: async () => {
      if (!id) return;
      await supabase.rpc('increment_part_views', { part_id: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['part-detail', id] });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!part) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">Запчасть не найдена</p>
          <Link to="/" className="text-blue-600 hover:underline">
            Вернуться к каталогу
          </Link>
        </div>
      </div>
    );
  }

  const images = part.images || [];
  const hasDiscount = part.old_price && part.old_price > (part.price || 0);
  const discount = hasDiscount ? Math.round(((part.old_price! - part.price!) / part.old_price!) * 100) : 0;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Назад</span>
            </button>

            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Галерея изображений */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImageIndex]}
                    alt={part.name}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-lg"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span className="text-8xl">📦</span>
                </div>
              )}
            </div>

            {/* Миниатюры */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 ${
                      idx === currentImageIndex ? 'border-blue-600' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Информация о товаре */}
          <div className="space-y-6">
            {/* Теги */}
            {part.tags && part.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {part.tags.includes('розпродаж') && (
                  <span className="bg-red-500 text-white text-sm px-3 py-1 rounded-full">РОЗПРОДАЖ</span>
                )}
                {part.tags.includes('новинки') && (
                  <span className="bg-green-500 text-white text-sm px-3 py-1 rounded-full">НОВИНКА</span>
                )}
                {part.tags.includes('хіти продаж') && (
                  <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full">ХІТ ПРОДАЖ</span>
                )}
              </div>
            )}

            {/* Название */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{part.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Артикул: {part.article || 'N/A'}</span>
                <span>•</span>
                <span>{part.category}</span>
                {part.views_count > 0 && (
                  <>
                    <span>•</span>
                    <span>{part.views_count} просмотров</span>
                  </>
                )}
              </div>
            </div>

            {/* Цена */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-baseline gap-4 mb-2">
                {part.price && (
                  <>
                    <span className="text-4xl font-bold text-green-600">
                      ${part.price}
                    </span>
                    {hasDiscount && (
                      <>
                        <span className="text-xl text-gray-400 line-through">
                          ${part.old_price}
                        </span>
                        <span className="bg-red-500 text-white text-sm font-bold px-2 py-1 rounded">
                          -{discount}%
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className={`text-sm font-medium ${part.in_stock ? 'text-green-600' : 'text-red-600'}`}>
                {part.in_stock ? '✓ В наличии' : '✗ Нет в наличии'}
              </div>
            </div>

            {/* Описание */}
            {part.description && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Описание</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{part.description}</p>
              </div>
            )}

            {/* Технические характеристики */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
              <h2 className="text-lg font-semibold mb-4">Технические характеристики</h2>
              
              {part.vin && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">VIN автомобиля-донора</span>
                  <span className="font-medium">{part.vin}</span>
                </div>
              )}
              
              {part.year && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Год выпуска</span>
                  <span className="font-medium">{part.year}</span>
                </div>
              )}
              
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Модель</span>
                <span className="font-medium">{part.category}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Состояние</span>
                <span className="font-medium">
                  {part.condition === 'new' ? 'Новое' : part.condition === 'used' ? 'Б/У' : 'Требует ремонта'}
                </span>
              </div>
              
              {part.subcategory && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Категория</span>
                  <span className="font-medium">{part.subcategory}</span>
                </div>
              )}
            </div>

            {/* Контакты разборки */}
            {(part.contact_phone || part.contact_address || part.contact_name) && (
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-blue-900">Контакты продавца</h2>
                
                {part.contact_name && (
                  <div className="text-gray-700">
                    <strong>{part.contact_name}</strong>
                  </div>
                )}
                
                {part.contact_phone && (
                  <a
                    href={`tel:${part.contact_phone}`}
                    className="flex items-center gap-3 text-blue-600 hover:text-blue-700"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-lg font-medium">{part.contact_phone}</span>
                  </a>
                )}
                
                {part.contact_address && (
                  <div className="flex items-start gap-3 text-gray-700">
                    <MapPin className="w-5 h-5 mt-0.5 text-gray-500" />
                    <span>{part.contact_address}</span>
                  </div>
                )}
                
                {part.working_hours && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <span>{part.working_hours}</span>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  {part.contact_phone && (
                    <>
                      <a
                        href={`tel:${part.contact_phone}`}
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-center font-medium"
                      >
                        Позвонить
                      </a>
                      <a
                        href={`https://wa.me/${part.contact_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition text-center font-medium"
                      >
                        WhatsApp
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
