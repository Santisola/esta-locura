import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        night: '#08111f',
        tide: '#0f2742',
        cyan: '#7dd3fc',
        sand: '#f3e8d2',
        ember: '#ef7d57',
      },
      boxShadow: {
        card: '0 24px 80px rgba(8, 17, 31, 0.28)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      backgroundImage: {
        pitch: 'radial-gradient(circle at top, rgba(125, 211, 252, 0.12), transparent 42%), linear-gradient(135deg, rgba(239, 125, 87, 0.16), transparent 45%)',
      },
    },
  },
  plugins: [],
}

export default config
