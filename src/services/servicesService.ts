import { supabase } from '../lib/supabase'
import { moveToTrash } from './trashService'

export interface ServiceCategory {
  id: string
  name: string
  color: string
  sort_order: number | null
  sto_company_id?: string | null
}

export interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration_minutes: number | null
  category_id: string | null
  sto_company_id?: string | null
  service_categories?: ServiceCategory | null
}

export interface ServiceFormData {
  name: string
  description: string
  price: string | number
  duration_minutes: string | number
  category_id: string
}

/** Fetch services for a specific STO company */
export async function fetchServices(stoCompanyId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*, service_categories(name, color)')
    .eq('sto_company_id', stoCompanyId)
    .order('name')

  if (error) throw error
  return data as Service[]
}

/** Fetch service categories for a specific STO company */
export async function fetchServiceCategories(stoCompanyId: string): Promise<ServiceCategory[]> {
  const { data } = await supabase
    .from('service_categories')
    .select('*')
    .eq('sto_company_id', stoCompanyId)
    .order('sort_order')

  return (data || []) as ServiceCategory[]
}

/** Fetch a single service by id */
export async function fetchServiceById(id: string): Promise<Service | null> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Service | null
}

/** Create a new service */
export async function createService(serviceData: {
  name: string
  description: string | null
  price: number
  duration_minutes: number | null
  category_id: string | null
  sto_company_id: string
}): Promise<void> {
  const { error } = await supabase.from('services').insert([serviceData])
  if (error) throw error
}

/** Update an existing service */
export async function updateService(id: string, serviceData: {
  name: string
  description: string | null
  price: number
  duration_minutes: number | null
  category_id: string | null
}): Promise<void> {
  const { error } = await supabase.from('services').update(serviceData).eq('id', id)
  if (error) throw error
}

/** Delete a service by id */
export async function deleteService(id: string, serviceData?: any, stoCompanyId?: string | null): Promise<void> {
  await moveToTrash({
    entityType: 'service',
    entityId: id,
    entityLabel: serviceData?.name || 'Услуга',
    entityData: serviceData || {},
    stoCompanyId,
  })
}

/** Fetch a single service raw (for trash snapshot) */
export async function fetchServiceRaw(id: string): Promise<any> {
  const { data } = await supabase.from('services').select('*').eq('id', id).single()
  return data
}

/** Create a new service category */
export async function createServiceCategory(categoryData: {
  name: string
  description?: string | null
  color: string
  icon?: string | null
  sort_order?: number
  sto_company_id: string
}): Promise<void> {
  const { error } = await supabase.from('service_categories').insert([categoryData])
  if (error) throw error
}

/** Update an existing service category */
export async function updateServiceCategory(id: string, categoryData: {
  name: string
  description?: string | null
  color: string
  icon?: string | null
  sort_order?: number
}): Promise<void> {
  const { error } = await supabase.from('service_categories').update(categoryData).eq('id', id)
  if (error) throw error
}

/** Delete a service category */
export async function deleteServiceCategory(id: string): Promise<void> {
  const { error } = await supabase.from('service_categories').delete().eq('id', id)
  if (error) throw error
}
