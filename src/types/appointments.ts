export type AppointmentStatus = 
  | 'pending'      // ⏳ Ожидает
  | 'confirmed'    // ✅ Подтверждена
  | 'in_progress'  // 🔧 В работе
  | 'completed'    // ✔️ Завершена
  | 'cancelled'    // ❌ Отменена
  | 'paid';        // 💰 Оплачена

export interface WorkItem {
  id: string;
  name: string;
  description?: string;
  price: number;
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
  work_items?: WorkItem[];
  part_items?: PartItem[];
  total_work_cost: number;
  total_parts_cost: number;
  total_cost: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentFormValues {
  customer_id: string;
  vehicle_id: string;
  scheduledDate: string;
  status: AppointmentStatus;
  notes: string;
  workItems: WorkItem[];
  partItems: PartItem[];
  selectedClient?: any;
  selectedVehicle?: any;
  assigned_to?: string;
}
