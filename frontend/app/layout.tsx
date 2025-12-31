import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BloxGrid - Own Your Block',
  description: 'Modern pixel marketplace with Roblox aesthetics. Buy blocks, upload images, and join the grid.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={montserrat.className}>
        {children}
        <footer className="bg-blox-dark text-white py-8 mt-16">
          <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
            <div className="text-sm text-gray-400">
              © 2025 BloxGrid · All rights reserved
            </div>
            <a
              href="/admin/login"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Admin
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
