import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold text-gray-900"
          style={{ letterSpacing: '-0.025em', lineHeight: '1.2' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500" style={{ letterSpacing: '-0.01em' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  )
}
