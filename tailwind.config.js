// A theme colour that also accepts Tailwind's opacity suffix (bg-primary/10), which BefUI relies on.
const tone = (name, fallback) =>
  `color-mix(in srgb, var(--${name}${fallback ? `, ${fallback}` : ''}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: tone('background', '#ffffff'),
        panel: tone('panel', '#f3f5fb'),
        foreground: tone('foreground', '#0f172a'),
        primary: {
          DEFAULT: tone('primary'),
          foreground: tone('primary-foreground'),
        },
        secondary: {
          DEFAULT: tone('secondary', '#f1f5f9'),
          foreground: tone('secondary-foreground', '#0f172a'),
        },
        accent: {
          DEFAULT: tone('accent'),
          foreground: tone('accent-foreground'),
        },
        card: {
          DEFAULT: tone('card', '#ffffff'),
          foreground: tone('card-foreground', '#0f172a'),
        },
        popover: {
          DEFAULT: tone('popover', '#ffffff'),
          foreground: tone('popover-foreground', '#0f172a'),
        },
        muted: {
          DEFAULT: tone('muted', '#f8fafc'),
          foreground: tone('muted-foreground', '#64748b'),
        },
        destructive: {
          DEFAULT: tone('destructive', '#e11d48'),
          foreground: '#ffffff',
        },
        border: tone('border', '#e2e8f0'),
        input: tone('input', '#e2e8f0'),
        ring: tone('ring'),
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB', // Main Primary #2563eb
          700: '#1D4ED8', // Accent Foreground #1d4ed8
          800: '#1E40AF',
          900: '#1E3A8A',
          espresso: '#172554',
          umber: '#1E3A8A',
          bark: '#1E40AF',
          clay: '#3B82F6',
          canvas: '#F8FAFC',
        },
        surface: tone('card', '#FFFFFF'),
        'text-main': tone('foreground', '#0F172A'),
        'text-muted': tone('muted-foreground', '#64748B'),
        success: {
          DEFAULT: tone('success', '#059669'),
          light: '#ECFDF5',
        },
        warning: {
          DEFAULT: tone('warning', '#d97706'),
          light: '#FFFBEB',
        },
        danger: {
          DEFAULT: tone('destructive', '#e11d48'),
          light: '#FEF2F2',
        },
        info: {
          DEFAULT: tone('info', '#2563eb'),
          light: '#F0F9FF',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Onest', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // figures use the same font as everything else (with equal-width digits, see index.css)
        mono: ['Onest', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
      },
      keyframes: {
        'bef-pop': { from: { opacity: '0', transform: 'scale(0.97) translateY(2px)' }, to: { opacity: '1', transform: 'none' } },
        'bef-pop-out': { to: { opacity: '0', transform: 'scale(0.97)' } },
        'bef-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'bef-fade-out': { to: { opacity: '0' } },
        'bef-shimmer': { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'bef-toast': { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'icon-draw': { from: { strokeDashoffset: '1px' }, to: { strokeDashoffset: '0' } },
      },
      animation: {
        pop: 'bef-pop var(--dur-fast) var(--ease-out)',
        'pop-out': 'bef-pop-out var(--dur-fast) var(--ease-out) forwards',
        'fade-out': 'bef-fade-out var(--dur-fast) var(--ease-out) forwards',
        'delayed-in': 'bef-fade-in var(--dur-fast) 150ms both',
        shimmer: 'bef-shimmer 1.6s linear infinite',
        toast: 'bef-toast var(--dur-base) var(--ease-out)',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
