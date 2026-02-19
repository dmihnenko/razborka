import { useState } from 'react';
import { Search, Phone, ChevronDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { PartCatalogItem, PartCategory, PartTag } from '../types/partsCatalog';

export default function PublicCatalog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PartCategory | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<PartTag | 'all'>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const categories: (PartCategory | 'all')[] = ['all', 'MODEL S', 'MODEL X', 'MODEL 3', 'MODEL Y', 'АВТО В НАЯВНОСТІ'];
  const tags: (PartTag | 'all')[] = ['all', 'розпродаж', 'новинки', 'хіти продаж'];
  
  const subcategoriesData = {
    '10 - Кузов': [
      '10.10 - Передня частина',
      '10.15 - Бокові панелі',
      '10.20 - Задня частина',
      '10.25 - Дах',
      '10.30 - Днище'
    ],
    '11 - Компоненти закриваючі': [
      '11.10 - Передні двері',
      '11.15 - Задні двері',
      '11.20 - Кришка багажника',
      '11.25 - Капот',
      '11.30 - Люки'
    ],
    '12 - Зовнішня фурнітура': [
      '12.10 - Дзеркала',
      '12.15 - Ручки дверей',
      '12.20 - Молдинги',
      '12.25 - Спойлери',
      '12.30 - Решітки'
    ],
    '13 - Сидіння': [
      '13.10 - Передні сидіння',
      '13.15 - Задні сидіння',
      '13.20 - Підголовники',
      '13.25 - Механізми регулювання'
    ],
    '14 - Приладова панель': [
      '14.10 - Панель приладів',
      '14.15 - Центральна консоль',
      '14.20 - Кермо',
      '14.25 - Дисплеї та екрани'
    ],
    '15 - Внутрішнє оздоблення': [
      '15.10 - Оббивка дверей',
      '15.15 - Килимки',
      '15.20 - Сонцезахисні козирки',
      '15.25 - Освітлення салону'
    ],
    '16 - Високовольтна акумуляторна батарея': [
      '16.10 - Батарейний модуль',
      '16.15 - Система охолодження батареї',
      '16.20 - BMS (система управління)',
      '16.25 - Корпус батареї'
    ],
    '17 - Електрика': [
      '17.10 - Проводка',
      '17.15 - Блоки управління',
      '17.20 - Датчики',
      '17.25 - Освітлення зовнішнє'
    ],
    '18 - Система управління температурним режимом': [
      '18.10 - Компресор',
      '18.15 - Радіатор',
      '18.20 - Вентилятори',
      '18.25 - Дефлектори'
    ],
    '19 - Етикетки': [],
    '20 - Безпека та захист': [
      '20.10 - Подушки безпеки',
      '20.15 - Ремені безпеки',
      '20.20 - Датчики безпеки'
    ],
    '21 - Інформаційна система підтримки водія': [
      '21.10 - Камери',
      '21.15 - Радари',
      '21.20 - Ультразвукові датчики',
      '21.25 - Блоки Autopilot'
    ],
    '30 - Ходова частина': [
      '30.10 - Підрамник',
      '30.15 - Стабілізатори',
      '30.20 - Пружини'
    ],
    '31 - Підвіска': [
      '31.10 - Амортизатори',
      '31.15 - Важелі',
      '31.20 - Сайлентблоки',
      '31.25 - Пневмопідвіска'
    ],
    '32 - Кермовий механізм': [
      '32.10 - Рейка',
      '32.15 - Наконечники',
      '32.20 - Тяги',
      '32.25 - Електропідсилювач'
    ],
    '33 - Гальма': [
      '33.10 - Диски',
      '33.15 - Колодки',
      '33.20 - Супорти',
      '33.25 - Гальмівні трубки'
    ],
    '34 - Колеса та шини': [
      '34.10 - Диски',
      '34.15 - Шини',
      '34.20 - Ковпаки',
      '34.25 - Датчики тиску'
    ],
    '39 - Передній привід': [
      '39.10 - Електродвигун передній',
      '39.15 - Редуктор',
      '39.20 - Півосі'
    ],
    '40 - Задній привід': [
      '40.10 - Електродвигун задній',
      '40.15 - Редуктор',
      '40.20 - Півосі'
    ],
    '44 - Високовольтна система': [
      '44.10 - Інвертор',
      '44.15 - Високовольтні кабелі',
      '44.20 - Роз\'єми HV'
    ],
    '50 - Зовнішні пристрої для зарядки': [
      '50.10 - Зарядний порт',
      '50.15 - Зарядний кабель',
      '50.20 - Mobile Connector',
      '50.25 - Wall Connector'
    ]
  };

  // Создаем плоский список для меню
  const subcategories = ['Всі категорії', ...Object.keys(subcategoriesData)];

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['parts-catalog', selectedCategory, selectedTag, selectedSubcategory, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('parts_catalog')
        .select('*')
        .eq('in_stock', true)
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      if (selectedTag !== 'all') {
        query = query.contains('tags', [selectedTag]);
      }

      if (selectedSubcategory !== 'all' && selectedSubcategory !== 'Всі категорії') {
        query = query.eq('subcategory', selectedSubcategory);
      }

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,article.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PartCatalogItem[];
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Логотип */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-xl text-gray-900">TESLA</div>
                <div className="text-xs text-gray-500">Parts Catalog</div>
              </div>
            </Link>

            {/* Поиск */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по названию, артикулу, VIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                Вход
              </Link>
            </div>
          </div>
        </div>

        {/* Меню категорий */}
        <div className="border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cat === 'all' ? 'ВСЕ МОДЕЛИ' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Табы тегов */}
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-4 py-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    selectedTag === tag
                      ? 'bg-red-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tag === 'all' ? 'ВСЕ' : tag.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Боковое меню с подкатегориями */}
        <div className="flex gap-6">
          {/* Фильтр подкатегорий */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-3">Категорії запчастин</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedSubcategory('all')}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    selectedSubcategory === 'all'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Всі категорії
                </button>
                
                {Object.entries(subcategoriesData).map(([category, subs]) => (
                  <div key={category}>
                    <div className="flex items-center">
                      <button
                        onClick={() => setSelectedSubcategory(category)}
                        className={`flex-1 text-left px-3 py-2 rounded text-sm transition ${
                          selectedSubcategory === category
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {category}
                      </button>
                      {subs.length > 0 && (
                        <button
                          onClick={() => toggleCategory(category)}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      )}
                    </div>
                    
                    {expandedCategories.has(category) && subs.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1">
                        {subs.map((sub) => (
                          <button
                            key={sub}
                            onClick={() => setSelectedSubcategory(sub)}
                            className={`w-full text-left px-3 py-1.5 rounded text-xs transition ${
                              selectedSubcategory === sub
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Сетка товаров */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                    <div className="aspect-square bg-gray-200 rounded-lg mb-4" />
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : parts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Запчасти не найдены</p>
                <p className="text-gray-400 text-sm mt-2">Попробуйте изменить фильтры или поисковый запрос</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {parts.map((part) => (
                  <PartCard key={part.id} part={part} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function PartCard({ part }: { part: PartCatalogItem }) {
  const hasDiscount = part.old_price && part.old_price > (part.price || 0);
  const discount = hasDiscount ? Math.round(((part.old_price! - part.price!) / part.old_price!) * 100) : 0;

  return (
    <Link
      to={`/part/${part.id}`}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden group"
    >
      {/* Изображение */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {part.images && part.images.length > 0 ? (
          <img
            src={part.images[0]}
            alt={part.name}
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">📦</span>
          </div>
        )}
        
        {/* Теги */}
        {part.tags && part.tags.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {part.tags.includes('розпродаж') && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">РОЗПРОДАЖ</span>
            )}
            {part.tags.includes('новинки') && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">НОВИНКА</span>
            )}
            {part.tags.includes('хіти продаж') && (
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">ХІТ</span>
            )}
          </div>
        )}

        {hasDiscount && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
            -{discount}%
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2 min-h-[3rem]">
          {part.name}
        </h3>
        
        <div className="text-xs text-gray-500 mb-2">
          {part.category}
          {part.article && <span className="ml-2">• {part.article}</span>}
        </div>

        {/* Цена */}
        <div className="flex items-baseline gap-2 mb-3">
          {part.price && (
            <>
              <span className="text-2xl font-bold text-green-600">
                ${part.price}
              </span>
              {hasDiscount && (
                <span className="text-sm text-gray-400 line-through">
                  ${part.old_price}
                </span>
              )}
            </>
          )}
        </div>

        {/* Статус */}
        <div className="flex items-center justify-between text-sm">
          <span className={part.in_stock ? 'text-green-600' : 'text-red-600'}>
            {part.in_stock ? '✓ В наявності' : 'Немає в наявності'}
          </span>
          {part.contact_phone && (
            <Phone className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>
    </Link>
  );
}
