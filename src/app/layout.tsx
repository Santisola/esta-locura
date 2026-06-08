import type { Metadata } from 'next'
import { Bricolage_Grotesque, Space_Mono } from 'next/font/google'

import './globals.css'

const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
})

const monoFont = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
})

export const metadata: Metadata = {
  title: 'Esta Locura',
  description: 'Draft y simulacion del Mundial 2026 con modo singleplayer y multiplayer.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${displayFont.variable} ${monoFont.variable} bg-night text-sand antialiased`}>
        {children}
      </body>
    </html>
  )
}
