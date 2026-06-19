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
        // Paleta "Albiceleste" — celeste / azul / violeta (referencia Selección Argentina)
        paper: '#e9f1fb',
        paper2: '#f2f7fd',
        bone: '#ffffff',
        ink: '#181a45',
        ink2: '#5a5f93',
        line: '#c3d3ea',
        // tokens semánticos (repurposed): acción principal = violeta, acento = celeste
        vermillion: '#6d4fe6',
        gold: '#2e9bd6',
        grass: '#3f8f57',
        grassdark: '#2f7547',
        // directos para gradientes
        celeste: '#37a6e6',
        azul: '#2b5fd0',
        violeta: '#6d4fe6',
      },
      boxShadow: {
        card: '0 24px 80px rgba(8, 17, 31, 0.28)',
        hard: '4px 4px 0 0 #181a45',
        hardsm: '3px 3px 0 0 #181a45',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
        slab: ['var(--font-slab)'],
      },
      keyframes: {
        rowIn: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-14px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '60%': { opacity: '1', transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        popScore: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '55%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        flashPulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(109, 79, 230, 0)' },
          '25%': { transform: 'scale(1.025)', boxShadow: '0 0 0 7px rgba(109, 79, 230, 0.38)' },
          '50%': { transform: 'scale(1)', boxShadow: '0 0 0 3px rgba(109, 79, 230, 0.22)' },
        },
      },
      animation: {
        rowIn: 'rowIn 0.45s cubic-bezier(0.2,0.8,0.2,1) both',
        fadeUp: 'fadeUp 0.5s cubic-bezier(0.2,0.8,0.2,1) both',
        slideIn: 'slideIn 0.35s ease-out both',
        pop: 'pop 0.42s cubic-bezier(0.2,0.9,0.3,1.3) both',
        popScore: 'popScore 0.5s cubic-bezier(0.2,0.9,0.3,1.3) both',
        flashPulse: 'flashPulse 0.65s ease-in-out 2',
      },
      backgroundImage: {
        pitch: 'radial-gradient(circle at top, rgba(125, 211, 252, 0.12), transparent 42%), linear-gradient(135deg, rgba(239, 125, 87, 0.16), transparent 45%)',
      },
    },
  },
  plugins: [],
}

export default config
