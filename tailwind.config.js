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
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
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
        // Sidebar palette
        sidebar: {
          DEFAULT: '#0C1220',
          hover:   '#162035',
          active:  '#1E3A6E',
          border:  'rgba(255,255,255,0.07)',
          text:    '#94A3B8',
          'text-active': '#FFFFFF',
        },
        // Brand
        brand: {
          DEFAULT: '#2563EB',
          hover:   '#1D4ED8',
          light:   '#EFF6FF',
        },
      },
      borderRadius: {
        sm:  '4px',
        DEFAULT: '8px',
        md:  '8px',
        lg:  '10px',
        xl:  '14px',
        '2xl': '18px',
        full: '9999px',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        dialog: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}
