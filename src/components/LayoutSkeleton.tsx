/**
 * Skeleton screens for layout loading states.
 * Used instead of spinners to reduce perceived loading time.
 */

/** Full-page skeleton that mimics the new Layout structure */
export function LayoutSkeleton() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex md:flex-col md:w-16 lg:w-64 bg-white border-r border-gray-200 flex-shrink-0">
        {/* Logo area */}
        <div className="h-14 flex items-center gap-3 px-2 lg:px-5 flex-shrink-0 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="hidden lg:block h-4 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Nav items */}
        <div className="flex-1 py-3 px-2 space-y-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2 rounded-lg">
              <div className="w-4 h-4 rounded bg-gray-200 animate-pulse flex-shrink-0" />
              <div className="hidden lg:block h-3.5 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="px-2 py-3 border-t border-gray-100 space-y-1">
          <div className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2">
            <div className="w-4 h-4 rounded bg-gray-200 animate-pulse flex-shrink-0" />
            <div className="hidden lg:block h-3 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2">
            <div className="w-4 h-4 rounded bg-gray-200 animate-pulse flex-shrink-0" />
            <div className="hidden lg:block h-3 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-auto bg-gray-50">
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
