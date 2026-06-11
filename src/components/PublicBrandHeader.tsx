import { Wrench } from 'lucide-react'

interface Props {
  subtitle?: string
}

export function PublicBrandHeader({ subtitle }: Props) {
  return (
    <div style={{ background: '#0D1117', borderBottom: '1px solid rgba(59,130,246,0.14)' }}>
      <div
        className="px-4 sm:px-6"
        style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '12px', paddingBottom: '12px' }}
      >
        <div
          style={{
            width: '30px',
            height: '30px',
            background: '#2563EB',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Wrench size={15} color="white" />
        </div>
        <div>
          <span
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontWeight: '700',
              color: '#F1F5F9',
              fontSize: '14px',
              letterSpacing: '0.5px',
              display: 'block',
              lineHeight: '1.2',
            }}
          >
            AutoCRM
          </span>
          {subtitle && (
            <span style={{ color: '#4B5563', fontSize: '11px', fontFamily: 'system-ui, sans-serif' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
