import './globals.css'

export const metadata = {
  title: 'TIV Archive',
  icons: {
    icon: { url: '/images/croptornado.png', type: 'image/png' },
    shortcut: '/images/croptornado.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
