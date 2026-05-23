import { supabase } from '../lib/supabase'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  notes: string | null
  sto_company_id: string | null
  created_at: string
  vehicles_count?: number
}

export interface CustomerFormData {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

/** Fetch all customers, optionally filtered by company, with vehicles count */
export async function fetchCustomers(params?: {
  stoCompanyId?: string | null
}): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true })

  if (params?.stoCompanyId) {
    query = query.eq('sto_company_id', params.stoCompanyId)
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
export async function createCustomer(customerData: CustomerFormData): Promise<void> {
  const { error } = await supabase.from('customers').insert([customerData])
  if (error) throw error
}

/** Update an existing customer */
export async function updateCustomer(id: string, customerData: Partial<CustomerFormData>): Promise<void> {
  const { error } = await supabase.from('customers').update(customerData).eq('id', id)
  if (error) throw error
}

/** Delete a customer by id */
export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) {
    console.error('Delete error:', error)
    throw error
  }
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
