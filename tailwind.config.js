/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './index.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          hover:   '#2563eb',
          active:  '#1d4ed8',
          light:   '#eff6ff',
          border:  '#bfdbfe',
        },
        surface: {
          page:  '#f3f4f6',
          card:  '#ffffff',
          muted: '#f9fafb',
          hover: '#f3f4f6',
        },
        success: {
          bg:    '#ecfdf5',
          text:  '#065f46',
          border:'#a7f3d0',
        },
        warning: {
          bg:    '#fffbeb',
          text:  '#92400e',
          border:'#fde68a',
        },
        danger: {
          bg:    '#fef2f2',
          text:  '#991b1b',
          border:'#fecaca',
        },
        info: {
          bg:    '#eff6ff',
          text:  '#1e40af',
          border:'#bfdbfe',
        },
        neutral: {
          bg:    '#f1f5f9',
          text:  '#1e293b',
          border:'#e2e8f0',
        },
      },
      fontSize: {
        display: ['1.375rem', { lineHeight: '1.35', letterSpacing: '-0.02em' }],
        title:   ['1.125rem', { lineHeight: '1.4' }],
        body:    ['0.875rem', { lineHeight: '1.55' }],
        caption: ['0.8125rem', { lineHeight: '1.4' }],
        xs:      ['0.75rem', { lineHeight: '1.4' }],
      },
      maxWidth: {
        content: '1600px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        DEFAULT: '0.375rem',   /* --radius-md */
        sm:  '0.25rem',
        md:  '0.375rem',
        lg:  '0.5rem',
        xl:  '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'token-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'token-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'token-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      transitionDuration: {
        fast:   '150ms',
        normal: '200ms',
      },
      zIndex: {
        dropdown: '100',
        sticky:   '200',
        modal:    '1000',
        toast:    '1100',
      },
    }
  },
  plugins: []
};