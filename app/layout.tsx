import './globals.css'
import type { Metadata } from 'next'
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  metadataBase: new URL('https://www.qorbanportal.online'),
  title: {
    default: 'Qorban Portal',
    template: '%s | Qorban Portal',
  },
  description:
    'Qorban Portal is an online grade management system for students, teachers, and school administrators.',
  keywords: [
    'Qorban Portal',
    'student portal',
    'grade management system',
    'online grading system',
    'school management system',
    'student information system',
    'teacher portal',
    'academic records',
  ],
  applicationName: 'Qorban Portal',
  authors: [{ name: 'Qorban Portal' }],
  creator: 'Qorban Portal',
  publisher: 'Qorban Portal',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: 'Qorban Portal',
    description:
      'Online grade management system for students, teachers, and school administrators.',
    url: 'https://www.qorbanportal.online',
    siteName: 'Qorban Portal',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.jpg',
        width: 1200,
        height: 630,
        alt: 'Qorban Portal Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Qorban Portal',
    description:
      'Online grade management system for students, teachers, and school administrators.',
    images: ['/logo.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}
        <Analytics />
      </body>
    </html>
  )
}