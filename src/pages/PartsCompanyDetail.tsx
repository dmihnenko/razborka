import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchPartsCompanyDetail } from '@/services/companyStatsService'
import CompanyStatsView from '@/components/admin/CompanyStatsView'

export default function PartsCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['parts-company-detail', companyId],
    queryFn: () => fetchPartsCompanyDetail(companyId!),
    enabled: !!companyId,
  })
  return <CompanyStatsView detail={data} isLoading={isLoading} kind="parts" backPath="/admin/parts-companies" />
}
