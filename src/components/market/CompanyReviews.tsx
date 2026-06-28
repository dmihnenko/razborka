import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getCompanyRating, getCompanyReviews, addCompanyReview } from '@/services/reviewsService'

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${value} из 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} style={{ width: size, height: size }} strokeWidth={1.5}
          fill={i <= Math.round(value) ? '#f59e0b' : 'none'}
          color={i <= Math.round(value) ? '#f59e0b' : 'var(--mk-text-3)'} />
      ))}
    </span>
  )
}

/** Отзывы и рейтинг разборки. Сам гейтится фиче-флагом market_reviews. */
export default function CompanyReviews({ companyId }: { companyId: string }) {
  const enabled = useFeatureFlag('market_reviews')
  const qc = useQueryClient()
  const { data: profile } = useUserProfile()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const { data: agg } = useQuery({
    queryKey: ['company-rating', companyId], queryFn: () => getCompanyRating(companyId), enabled,
  })
  const { data: reviews = [] } = useQuery({
    queryKey: ['company-reviews', companyId], queryFn: () => getCompanyReviews(companyId), enabled,
  })

  const submit = useMutation({
    mutationFn: () => addCompanyReview(companyId, rating, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-rating', companyId] })
      qc.invalidateQueries({ queryKey: ['company-reviews', companyId] })
      setComment(''); setRating(0)
      toast.success('Спасибо за отзыв!')
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Не удалось отправить отзыв'),
  })

  if (!enabled) return null

  return (
    <div className="mk-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="mk-title">Отзывы</h2>
        {agg && agg.count > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <Stars value={agg.avg} />
            <span className="font-bold" style={{ color: 'var(--mk-text)' }}>{agg.avg}</span>
            <span className="mk-meta">({agg.count})</span>
          </span>
        )}
      </div>

      {profile?.id ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <button key={i} type="button" onClick={() => setRating(i)} aria-label={`Оценка ${i}`}>
                <Star className="w-6 h-6" strokeWidth={1.5}
                  fill={i <= rating ? '#f59e0b' : 'none'}
                  color={i <= rating ? '#f59e0b' : 'var(--mk-text-3)'} />
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
            placeholder="Ваш отзыв (необязательно)" className="mk-input w-full" />
          <button type="button" disabled={!rating || submit.isPending} onClick={() => submit.mutate()}
            className="mk-btn mk-btn-accent disabled:opacity-50">
            {submit.isPending ? 'Отправка…' : 'Оставить отзыв'}
          </button>
        </div>
      ) : (
        <p className="mk-meta text-sm">Войдите в аккаунт, чтобы оставить отзыв.</p>
      )}

      <div>
        {reviews.length === 0 ? (
          <p className="mk-meta text-sm">Пока нет отзывов — будьте первым.</p>
        ) : reviews.map((r, idx) => (
          <div key={r.id} className={idx === 0 ? '' : 'mk-divider pt-3 mt-3'}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--mk-text)' }}>{r.author}</span>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p className="text-sm mt-1" style={{ color: 'var(--mk-text-2)' }}>{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
