/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        card: {
          DEFAULT: 'var(--card, #ffffff)',
          foreground: 'var(--card-foreground, #0f172a)',
        },
        muted: {
          DEFAULT: 'var(--muted, #f8fafc)',
          foreground: 'var(--muted-foreground, #64748b)',
        },
        destructive: {
          DEFAULT: 'var(--destructive, #ef4444)',
          foreground: '#ffffff',
        },
        ring: 'var(--ring)',
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5', // Main Primary #4f46e5
          700: '#4338CA', // Accent Foreground #4338ca
          800: '#3730A3',
          900: '#312E81',
          espresso: '#1E1B4B',
          umber: '#312E81',
          bark: '#3730A3',
          clay: '#6366F1',
          canvas: '#F8FAFC',
        },
        surface: '#FFFFFF',
        border: '#E2E8F0',
        'text-main': '#0F172A',
        'text-muted': '#64748B',
        success: {
          DEFAULT: '#10B981',
          light: '#ECFDF5',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FFFBEB',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEF2F2',
        },
        info: {
          DEFAULT: '#0284C7',
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
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
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
