module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './index.html'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        surface: {
          page: '#f3f4f6',
          card: '#ffffff',
          muted: '#f9fafb',
        },
      },
      fontSize: {
        display: ['1.375rem', { lineHeight: '1.35', letterSpacing: '-0.02em' }],
        title: ['1.125rem', { lineHeight: '1.4' }],
        body: ['0.875rem', { lineHeight: '1.55' }],
        caption: ['0.8125rem', { lineHeight: '1.4' }],
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
    }
  },
  plugins: []
};
