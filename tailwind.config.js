export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        surface: '#ffffff',
        canvas: '#f6f7f3',
        ink: '#1a2418',
        /** Primary actions: deep forest green */
        primary: { DEFAULT: '#2f4832', hover: '#3b5a3f' },
        muted: '#5f6a5a',
        subtle: '#7d8777',
        line: '#dfe4da',
        /** Selected tabs, chips and soft highlights */
        tint: '#e4ece4',
        /** Over budget, destructive, needs-review */
        alert: { DEFAULT: '#b1462d', hover: '#9a3b25' },
        /** The three buckets, used on the donut and every bucket tag */
        needs: '#2f4832',
        wants: '#c4764c',
        savings: '#3f7a78',
        /** Warm green-gray scale for buttons, borders and disabled states */
        stone: {
          50: '#f6f7f3',
          100: '#eceee8',
          200: '#dfe4da',
          300: '#c9d0c4',
          400: '#a3ac9e',
          500: '#7d8777',
          600: '#5f6a5a',
          700: '#434d3f',
          900: '#1a2418',
        },
        /** Six-color set for category charts, in the order they are used */
        chart: {
          forest: '#2f4832',
          teal: '#3f7a78',
          clay: '#c4764c',
          sand: '#d4b170',
          plum: '#8a5f7e',
          sage: '#8fbfa3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
        control: '12px',
      },
    },
  },
  plugins: [],
}
