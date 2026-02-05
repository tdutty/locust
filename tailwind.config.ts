import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        beige: '#FAF9F6',
        primary: {
          DEFAULT: '#000000',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#dc2626',
          light: 'rgba(220, 38, 38, 0.10)',
        },
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '9999px',
      },
      borderWidth: {
        DEFAULT: '2px',
        '0': '0px',
        '1': '1px',
        '2': '2px',
        '3': '3px',
      },
      boxShadow: {
        none: 'none',
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'fade-in': 'fade-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
