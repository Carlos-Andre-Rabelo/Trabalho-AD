/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
        ru: {
          primary: '#1e3a8a', // Azul acadêmico sólido
          primaryHover: '#172554',
          accent: '#0d9488', // Teal
          surface: '#ffffff',
          background: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
        },
      },
      minHeight: {
        touch: '48px',
      },
    },
  },
  plugins: [],
};
