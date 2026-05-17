/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paro: {
          operaciones: '#dc2626',
          mantenimiento: '#2563eb',
          materiales: '#ea580c',
          programados: '#6b7280',
        }
      }
    },
  },
  plugins: [],
}
