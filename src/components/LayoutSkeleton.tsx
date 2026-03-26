/**
 * Skeleton screens for layout loading states.
 * Used instead of spinners to reduce perceived loading time.
 */

/** Full-page skeleton that mimics the new Layout structure */
export function LayoutSkeleton() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Sidebar skeleton */}
      <div
        className="hidden md:flex md:flex-col w-[60px] lg:w-[220px] xl:w-[240px] flex-shrink-0"
        style={{ backgroundColor: '#0C1220', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo area */}
        <div className="h-14 flex items-center gap-3 px-2 lg:px-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-8 h-8 rounded-lg bg-blue-900/50 animate-pulse flex-shrink-0" />
          <div className="hidden lg:block h-4 w-20 bg-blue-900/40 rounded animate-pulse" />
        </div>
        {/* Nav items */}
        <div className="flex-1 py-3 px-2 space-y-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2.5 rounded-lg">
              <div className="w-[18px] h-[18px] rounded bg-blue-900/40 animate-pulse flex-shrink-0" />
              <div className="hidden lg:block h-3.5 w-24 bg-blue-900/30 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="px-2 py-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-blue-900/40 animate-pulse flex-shrink-0" />
            <div className="hidden lg:block h-3 w-16 bg-blue-900/30 rounded animate-pulse" />
          </div>
          <div className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2">
            <div className="w-[18px] h-[18px] rounded bg-blue-900/30 animate-pulse flex-shrink-0" />
            <div className="hidden lg:block h-3 w-12 bg-blue-900/20 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="mx-auto max-w-[1440px] w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          {/* Breadcrumb */}
          <div className="h-3.5 w-36 bg-gray-200 rounded animate-pulse mb-5" />
          {/* Page title */}
          <div className="h-7 w-52 bg-gray-200 rounded animate-pulse mb-6" />
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-white rounded-xl border border-gray-200 animate-pulse" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} />
            ))}
          </div>
          {/* Table block */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-11 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
