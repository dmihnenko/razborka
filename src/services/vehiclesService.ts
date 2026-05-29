import { supabase } from '../lib/supabase'
import { moveToTrash } from './trashService'

export interface Vehicle {
  id: string
  customer_id: string
  brand: string
  model: string
  year: number
  license_plate: string
  vin: string | null
  color: string | null
  mileage: number | null
  sto_company_id: string | null
  created_at: string
  customers?: { id: string; name: string } | null
}

export interface VehicleSaveData {
  customer_id: string
  brand: string
  model: string
  year: number
  license_plate: string
  vin: string
  color: string
  mileage: number | null
}

export interface CustomerOption {
  id: string
  name: string
}

/** Fetch all vehicles, optionally filtered by company and/or customer */
export async function fetchVehicles(params?: {
  stoCompanyId?: string | null
  customerId?: string | null
}): Promise<Vehicle[]> {
  let query = supabase
    .from('vehicles')
    .select('*, customers(name, id)')
    .order('created_at', { ascending: false })

  // SECURITY: Always filter by company — never return all vehicles
  if (params?.stoCompanyId) {
    query = query.eq('sto_company_id', params.stoCompanyId)
  } else if (!params?.customerId) {
    // No company and no customer filter — return empty to prevent data leak
    return []
  }
  if (params?.customerId) {
    query = query.eq('customer_id', params.customerId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Vehicle[]
}

/** Fetch vehicles for a specific customer */
export async function fetchCustomerVehicles(customerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Vehicle[]
}

/** Fetch a single vehicle by id */
export async function fetchVehicleById(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Vehicle | null
}

/** Create a new vehicle */
export async function createVehicle(vehicleData: VehicleSaveData): Promise<void> {
  const { error } = await supabase.from('vehicles').insert([vehicleData])
  if (error) throw error
}

/** Update an existing vehicle */
export async function updateVehicle(id: string, vehicleData: Partial<VehicleSaveData>): Promise<void> {
  const { error } = await supabase.from('vehicles').update(vehicleData).eq('id', id)
  if (error) throw error
}

/** Delete a vehicle by id */
export async function deleteVehicle(id: string, vehicleData?: any, stoCompanyId?: string | null): Promise<void> {
  await moveToTrash({
    entityType: 'vehicle',
    entityId: id,
    entityLabel: vehicleData ? `${vehicleData.brand || ''} ${vehicleData.model || ''}`.trim() : 'Автомобиль',
    entityData: vehicleData || {},
    stoCompanyId,
  })
}

/** Fetch customers list (id + name) for vehicle owner dropdown */
export async function fetchCustomerOptions(): Promise<CustomerOption[]> {
  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .order('name')
  return data || []
}

export async function fetchVehicleAppointments(vehicleId: string) {
  const { data } = await supabase.from('appointments').select('*').eq('vehicle_id', vehicleId)
  return data || []
}
