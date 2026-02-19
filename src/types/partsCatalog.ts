export interface PartCatalogItem {
  id: string;
  name: string;
  description: string | null;
  article: string | null;
  price: number | null;
  old_price: number | null;
  category: 'MODEL S' | 'MODEL X' | 'MODEL 3' | 'MODEL Y' | 'АВТО В НАЯВНОСТІ';
  subcategory: string | null;
  condition: 'new' | 'used' | 'damaged';
  in_stock: boolean;
  images: string[];
  vin: string | null;
  year: number | null;
  
  // Контакты разборки
  company_id: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  contact_name: string | null;
  working_hours: string | null;
  
  tags: string[]; // 'новинка', 'хит продаж', 'распродажа'
  
  views_count: number;
  created_at: string;
  updated_at: string;
}

export type PartCategory = 'MODEL S' | 'MODEL X' | 'MODEL 3' | 'MODEL Y' | 'АВТО В НАЯВНОСТІ';
export type PartTag = 'розпродаж' | 'новинки' | 'хіти продаж';
