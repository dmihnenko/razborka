/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Manrope Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Нейтральные = slate (сталисто-синие). Весь существующий код на
        // text-gray-*/bg-gray-* автоматически получает холодный оттенок.
        gray: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        // HSL token bridge (used by shadcn-style components)
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Sidebar palette (navy dark surface)
        sidebar: {
          DEFAULT:     '#0C1220',
          hover:       '#162035',
          active:      '#1173D4',   /* = brand-600 */
          border:      'rgba(255,255,255,0.07)',
          text:        '#94A3B8',
          'text-active': '#FFFFFF',
        },
        // Navy surfaces
        navy: {
          DEFAULT: '#0E1C3D',
          deep:    '#0A1530',
        },
        // Brand
        brand: {
          DEFAULT: '#1173D4',
          hover:   '#0E5FB0',
          light:   '#EAF4FE',
          glow:    '#1E86E5',
        },
      },
      borderRadius: {
        sm:      '4px',
        DEFAULT: '8px',
        md:      '8px',
        lg:      '10px',
        xl:      '14px',
        '2xl':   '18px',
        '3xl':   '24px',
        full:    '9999px',
      },
      boxShadow: {
        // AutoCRM-aligned card shadows (lighter, border-first philosophy)
        card:           '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)',
        'card-hover':   '0 4px 12px rgba(0,0,0,.10), 0 2px 4px rgba(0,0,0,.06)',
        dialog:         '0 20px 60px rgba(0,0,0,.15)',
        // Keep existing project-specific shadows
        float:          '0 4px 12px -2px rgba(15,23,42,0.08), 0 16px 32px -12px rgba(15,23,42,0.14)',
        'glow-blue':    '0 1px 2px rgba(37,99,235,0.35), 0 4px 12px -2px rgba(37,99,235,0.35)',
        'glow-blue-lg': '0 2px 4px rgba(37,99,235,0.35), 0 8px 20px -4px rgba(37,99,235,0.45)',
      },
      keyframes: {
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to:   { transform: 'scale(1)',    opacity: '1' },
        },
      },
      animation: {
        'fade-in':  'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
