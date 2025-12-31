import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Roblox-inspired color palette
        blox: {
          red: '#e02b20',
          blue: '#0066ff',
          green: '#00a94f',
          yellow: '#ffc000',
          dark: '#1a1a1a',
          light: '#f5f5f5',
          gray: '#393b3d',
        }
      },
      fontFamily: {
        // Use a blocky, game-inspired font
        sans: ['"Montserrat"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'blox': '4px 4px 0px 0px rgba(0, 0, 0, 0.25)',
        'blox-hover': '6px 6px 0px 0px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
export default config
