export type AppointmentStatus = 
  | 'scheduled'    // 📅 Запланирована
  | 'in_progress'  // 🔧 В работе
  | 'ready'        // ✅ Готова
  | 'completed'    // ✔️ Завершена
  | 'archived'     // 🗄️ Архив
  | 'cancelled'    // ❌ Отменена
  | 'pending_deletion' // 🗑️ Ожидает удаления
  | 'deleted';     // 🚫 Удалена

export interface AppointmentPart {
  id: string;
  appointment_id: string;
  description: string;
  created_at: string;
}

export interface WorkItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  normHours?: number; // нормо-часы из каталога (снимок); ручные работы — 0/undefined
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
}

export interface PartItem {
  id: string;
  name: string;
  articleNumber?: string;
  quantity: number;
  price: number;
  // markup: number;
  // markupType: 'percentage' | 'fixed';
  totalPrice: number;
  condition?: 'new-original' | 'used-original' | 'aftermarket';
  isPaid: boolean;
  paidAt?: string;
  supplier?: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  sto_company_id: string;
  customer_id: string;
  vehicle_id: string;
  status: AppointmentStatus;
  scheduled_date: string;
  scheduled_time?: string;
  work_items?: WorkItem[];
  part_items?: PartItem[];
  appointment_parts?: AppointmentPart[]; // Запчасти из Firebase
  total_work_cost: number;
  total_parts_cost: number;
  total_cost: number;
  extra_hours?: number;        // доп. время для работы с авто клиента (н·ч)
  total_norm_hours?: number;   // сумма нормо-часов каталожных работ
  labor_rate?: number;         // снимок ставки нормо-часа на момент записи
  notes?: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  assigned_to_name?: string;
  parts_paid: boolean;
  work_paid: boolean;
  parts_cost?: number;
  parts_client_cost?: number;
  ready_for_pickup?: boolean;
  completed_at?: string;
  request_number?: string;
  description?: string;
  firebase_id?: string;
}

export interface AppointmentComment {
  id: string;
  appointment_id: string;
  sto_company_id: string;
  user_id: string;
  text: string;
  created_at: string;
  author_profile?: {
    full_name: string | null;
    email: string | null;
  };
}

export interface AppointmentFormValues {
  customer_id: string;
  vehicle_id: string;
  scheduledDate: string;
  scheduledEndDate?: string | null;
  status: AppointmentStatus;
  notes: string;
  workItems: WorkItem[];
  partItems: PartItem[];
  extraHours?: number;
  selectedClient?: any;
  selectedVehicle?: any;
  assigned_to?: string;
  parts_paid?: boolean;
  work_paid?: boolean;
}
