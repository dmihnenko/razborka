import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchStoCompanyDetail } from '@/services/companyStatsService'
import CompanyStatsView from '@/components/admin/CompanyStatsView'

export default function StoCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['sto-company-detail', companyId],
    queryFn: () => fetchStoCompanyDetail(companyId!),
    enabled: !!companyId,
  })
  return <CompanyStatsView detail={data} isLoading={isLoading} kind="sto" backPath="/admin/sto" />
}
