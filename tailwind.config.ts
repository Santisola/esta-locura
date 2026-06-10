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
      backgroundImage: {
        pitch: 'radial-gradient(circle at top, rgba(125, 211, 252, 0.12), transparent 42%), linear-gradient(135deg, rgba(239, 125, 87, 0.16), transparent 45%)',
      },
    },
  },
  plugins: [],
}

export default config
