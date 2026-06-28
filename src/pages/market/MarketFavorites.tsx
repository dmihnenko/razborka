import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { getMarketPartsByIds } from '@/services/marketplaceService'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import EmptyState from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { usePageMeta } from '@/hooks/usePageMeta'

export function MarketFavorites() {
  usePageMeta('Избранное — Razborka.net', 'Сохранённые запчасти.')
  const fav = useFavorites()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['favorites-parts', fav.ids],
    queryFn: () => getMarketPartsByIds(fav.ids),
    enabled: fav.canUse && fav.ids.length > 0,
  })

  return (
    <div className="space-y-4">
      <h1 className="mk-title">Избранное</h1>
      {!fav.canUse ? (
        <EmptyState icon={Heart} title="Войдите в аккаунт" description="Избранное доступно после входа в аккаунт." />
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Пока пусто"
          description="Добавляйте запчасти кнопкой ♥ в каталоге."
          action={<Link to="/market/catalog" className="mk-btn mk-btn-accent">В каталог</Link>}
        />
      ) : (
        <div className="mk-grid">{items.map(p => <MarketProductCard key={p.id} part={p} />)}</div>
      )}
    </div>
  )
}

export default MarketFavorites
