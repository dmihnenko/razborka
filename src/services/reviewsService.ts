import { supabase } from '@/lib/supabase'

export interface CompanyReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  author: string
}

export async function getCompanyRating(companyId: string): Promise<{ avg: number; count: number }> {
  const { data, error } = await supabase.rpc('get_company_rating', { p_company_id: companyId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { avg: Number(row?.avg_rating ?? 0), count: Number(row?.review_count ?? 0) }
}

export async function getCompanyReviews(companyId: string): Promise<CompanyReview[]> {
  const { data, error } = await supabase.rpc('get_company_reviews', { p_company_id: companyId })
  if (error) throw error
  return (data || []) as CompanyReview[]
}

export async function addCompanyReview(companyId: string, rating: number, comment: string): Promise<void> {
  const { error } = await supabase.rpc('add_company_review', {
    p_company_id: companyId, p_rating: rating, p_comment: comment,
  })
  if (error) throw error
}
