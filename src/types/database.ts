export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          display_name: string;
          description: string | null;
          permissions: Record<string, any>;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          display_name: string;
          description?: string | null;
          permissions?: Record<string, any>;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          display_name?: string;
          description?: string | null;
          permissions?: Record<string, any>;
          is_active?: boolean;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          created_at: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role_id: string | null;
          is_active: boolean;
          last_login: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role_id?: string | null;
          is_active?: boolean;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role_id?: string | null;
          is_active?: boolean;
          last_login?: string | null;
        };
      };
      service_categories: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string | null
          color: string
          icon: string | null
          sort_order: number
          sto_company_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string | null
          color?: string
          icon?: string | null
          sort_order?: number
          sto_company_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string | null
          color?: string
          icon?: string | null
          sort_order?: number
          sto_company_id?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          created_at: string
          name: string
          phone: string
          email: string | null
          address: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          phone: string
          email?: string | null
          address?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          phone?: string
          email?: string | null
          address?: string | null
          notes?: string | null
        }
      }
      vehicles: {
        Row: {
          id: string
          created_at: string
          customer_id: string
          brand: string
          model: string
          year: number
          vin: string | null
          license_plate: string
          color: string | null
          mileage: number | null
          sto_company_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          customer_id: string
          brand: string
          model: string
          year: number
          vin?: string | null
          license_plate: string
          color?: string | null
          mileage?: number | null
          sto_company_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          customer_id?: string
          brand?: string
          model?: string
          year?: number
          vin?: string | null
          license_plate?: string
          color?: string | null
          mileage?: number | null
          sto_company_id?: string | null
        }
      }
      services: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string | null
          price: number
          duration_minutes: number | null
          category_id: string | null
          sto_company_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string | null
          price: number
          duration_minutes?: number | null
          category_id?: string | null
          sto_company_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string | null
          price?: number
          duration_minutes?: number | null
          category_id?: string | null
          sto_company_id?: string | null
        }
      }
      appointments: {
        Row: {
          id: string
          created_at: string
          customer_id: string
          vehicle_id: string
          scheduled_date: string
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          customer_id: string
          vehicle_id: string
          scheduled_date: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          customer_id?: string
          vehicle_id?: string
          scheduled_date?: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes?: string | null
        }
      }
      work_orders: {
        Row: {
          id: string
          created_at: string
          customer_id: string
          vehicle_id: string
          status: 'draft' | 'in_progress' | 'completed' | 'invoiced'
          description: string | null
          part_items: Json | null
          total_cost: number
          sto_company_id: string
          created_by: string
          assigned_to: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          customer_id: string
          vehicle_id: string
          status?: 'draft' | 'in_progress' | 'completed' | 'invoiced'
          description?: string | null
          part_items?: Json | null
          total_cost?: number
          sto_company_id: string
          created_by: string
          assigned_to?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          customer_id?: string
          vehicle_id?: string
          status?: 'draft' | 'in_progress' | 'completed' | 'invoiced'
          description?: string | null
          part_items?: Json | null
          total_cost?: number
          sto_company_id?: string
          created_by?: string
          assigned_to?: string | null
        }
      }
      parts: {
        Row: {
          id: string
          created_at: string
          name: string
          part_number: string | null
          description: string | null
          quantity_in_stock: number
          min_quantity: number
          price: number
          supplier: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          part_number?: string | null
          description?: string | null
          quantity_in_stock?: number
          min_quantity?: number
          price: number
          supplier?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          part_number?: string | null
          description?: string | null
          quantity_in_stock?: number
          min_quantity?: number
          price?: number
          supplier?: string | null
        }
      }
      invoices: {
        Row: {
          id: string
          created_at: string
          work_order_id: string
          customer_id: string
          invoice_number: string
          issue_date: string
          due_date: string
          total_amount: number
          paid_amount: number
          status: 'pending' | 'paid' | 'overdue' | 'cancelled'
          payment_method: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          work_order_id: string
          customer_id: string
          invoice_number: string
          issue_date: string
          due_date: string
          total_amount: number
          paid_amount?: number
          status?: 'pending' | 'paid' | 'overdue' | 'cancelled'
          payment_method?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          work_order_id?: string
          customer_id?: string
          invoice_number?: string
          issue_date?: string
          due_date?: string
          total_amount?: number
          paid_amount?: number
          status?: 'pending' | 'paid' | 'overdue' | 'cancelled'
          payment_method?: string | null
          notes?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
