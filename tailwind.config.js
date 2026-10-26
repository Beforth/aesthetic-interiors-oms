/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background, #ffffff)',
        foreground: 'var(--foreground, #0f172a)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary, #f1f5f9)',
          foreground: 'var(--secondary-foreground, #0f172a)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        card: {
          DEFAULT: 'var(--card, #ffffff)',
          foreground: 'var(--card-foreground, #0f172a)',
        },
        popover: {
          DEFAULT: 'var(--popover, #ffffff)',
          foreground: 'var(--popover-foreground, #0f172a)',
        },
        muted: {
          DEFAULT: 'var(--muted, #f8fafc)',
          foreground: 'var(--muted-foreground, #64748b)',
        },
        destructive: {
          DEFAULT: 'var(--destructive, #e11d48)',
          foreground: '#ffffff',
        },
        border: 'var(--border, #e2e8f0)',
        input: 'var(--input, #e2e8f0)',
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
        'text-main': '#0F172A',
        'text-muted': '#64748B',
        success: {
          DEFAULT: 'var(--success, #059669)',
          light: '#ECFDF5',
        },
        warning: {
          DEFAULT: 'var(--warning, #d97706)',
          light: '#FFFBEB',
        },
        danger: {
          DEFAULT: 'var(--destructive, #e11d48)',
          light: '#FEF2F2',
        },
        info: {
          DEFAULT: 'var(--info, #2563eb)',
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
