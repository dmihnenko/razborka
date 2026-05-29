import { supabase } from '../lib/supabase'
import { moveToTrash } from './trashService'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  address?: string | null
  notes: string | null
  sto_company_id: string | null
  created_at: string
  vehicles_count?: number
}

export interface CustomerFormData {
  name: string
  phone: string
  email: string
  address?: string
  notes: string
}

/** Fetch customers filtered by company — ALWAYS requires stoCompanyId for security */
export async function fetchCustomers(params?: {
  stoCompanyId?: string | null
}): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true })

  // SECURITY: Always filter by company — never return all customers
  if (params?.stoCompanyId) {
    query = query.eq('sto_company_id', params.stoCompanyId)
  } else {
    // Return empty if no company context — prevents data leak
    return []
  }

  const { data, error } = await query
  if (error) throw error

  const customersWithVehicles = await Promise.all(
    (data as Customer[]).map(async (customer) => {
      const { count } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
      return { ...customer, vehicles_count: count || 0 }
    })
  )

  return customersWithVehicles
}

/** Fetch a single customer by id */
export async function fetchCustomerById(id: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Customer
}

/** Create a new customer */
export async function createCustomer(customerData: CustomerFormData, stoCompanyId?: string | null): Promise<void> {
  const { error } = await supabase.from('customers').insert([{
    ...customerData,
    sto_company_id: stoCompanyId || null,
  }])
  if (error) throw error
}

/** Update an existing customer */
export async function updateCustomer(id: string, customerData: Partial<CustomerFormData>): Promise<void> {
  const { error } = await supabase.from('customers').update(customerData).eq('id', id)
  if (error) throw error
}

/** Soft-delete a customer (move to trash) */
export async function deleteCustomer(id: string, customerData?: any, stoCompanyId?: string | null): Promise<void> {
  await moveToTrash({
    entityType: 'customer',
    entityId: id,
    entityLabel: customerData?.name || 'Клиент',
    entityData: customerData || {},
    stoCompanyId,
  })
}

/** Fetch all customer data for trash (vehicles + appointments snapshot) */
export async function fetchCustomerForTrash(id: string): Promise<{
  customer: Customer | null
  vehicles: any[]
  appointments: any[]
}> {
  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single()
  const { data: vehicles } = await supabase.from('vehicles').select('*').eq('customer_id', id)
  const { data: appointments } = await supabase.from('appointments').select('*').eq('customer_id', id)

  return {
    customer: customer || null,
    vehicles: vehicles || [],
    appointments: appointments || [],
  }
}

// ============================================================================
// CustomerProfile page queries
// ============================================================================

export interface Appointment {
  id: string
  customer_id: string
  vehicle_id: string | null
  scheduled_date?: string
  appointment_date?: string
  status: string
  description?: string | null
  request_number?: string | null
  created_at: string
  vehicles?: { brand: string; model: string; license_plate: string } | null
}

export interface PartsOrder {
  id: string
  customer_id: string
  order_number: string
  status: string
  total_amount: number
  order_date: string
  notes: string | null
  created_at: string
  items?: Array<{
    id: string
    quantity: number
    price_at_sale: number
    subtotal: number
    inventory_item?: { name: string; part_number: string | null } | null
  }>
}

/** Fetch appointments for a customer */
export async function fetchCustomerAppointments(customerId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, vehicles(brand, model, license_plate)')
    .eq('customer_id', customerId)
    .order('scheduled_date', { ascending: false })
  if (error) throw error
  return (data || []) as Appointment[]
}

/** Fetch parts orders linked to a customer by phone */
export async function fetchCustomerPartsOrders(phone: string): Promise<PartsOrder[]> {
  const { data: partsCustomers, error: customerError } = await supabase
    .from('parts_customers')
    .select('id')
    .eq('phone', phone)
  if (customerError) throw customerError
  if (!partsCustomers || partsCustomers.length === 0) return []

  const customerIds = partsCustomers.map(c => c.id)
  const { data, error } = await supabase
    .from('parts_orders')
    .select(`
      *,
      items:parts_order_items(
        id,
        quantity,
        price_at_sale,
        subtotal,
        inventory_item:parts_inventory(
          name,
          part_number
        )
      )
    `)
    .in('customer_id', customerIds)
    .order('order_date', { ascending: false })
  if (error) throw error
  return (data || []) as PartsOrder[]
}

/** Fetch appointments for a vehicle (used in delete snapshot) */
export async function fetchVehicleAppointments(vehicleId: string): Promise<any[]> {
  const { data } = await supabase.from('appointments').select('*').eq('vehicle_id', vehicleId)
  return data || []
}
