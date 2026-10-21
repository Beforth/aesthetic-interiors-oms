/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F8F6F4',
          100: '#EFEAE6',
          500: '#7D5A44',
          600: '#6B4D3A',
          700: '#593F2F',
        },
        surface: '#FFFFFF',
        border: '#DCD6D0',
        'text-main': '#1F2933',
        'text-muted': '#6B7785',
        success: {
          DEFAULT: '#2F855A',
          light: '#EAF3EE',
        },
        warning: {
          DEFAULT: '#B7791F',
          light: '#FAF2E8',
        },
        danger: {
          DEFAULT: '#C53030',
          light: '#F9EAEA',
        },
        info: {
          DEFAULT: '#3B6EA5',
          light: '#EBF1F7',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
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
