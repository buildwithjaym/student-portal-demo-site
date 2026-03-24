import './globals.css'

export const metadata = {
  title: 'Qorban Portal',
  description: 'Online Grade Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}