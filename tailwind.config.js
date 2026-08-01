export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        surface: '#ffffff',
        canvas: '#faf9f7',
        ink: '#1c1a17',
        /** Primary actions: warm dark gray */
        primary: '#38352f',
        muted: '#6f6a62',
        subtle: '#a39d94',
        line: '#eceae5',
        /** Over budget, destructive, needs-review */
        alert: '#b1462d',
        /** Warm earth trio — used for the buckets and every chart */
        needs: '#6f7a4a',
        wants: '#c1743c',
        savings: '#93627e',
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
