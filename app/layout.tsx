import './globals.css'
import type { Metadata } from 'next'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  metadataBase: new URL('https://student-portal-demo-site.vercel.app/'),
  title: {
    default: 'Student Portal',
    template: '%s | Student Portal',
  },
  description:
    'Riverside National Senior High School Student Portal is an online grade management system for students, teachers, and school administrators.',
  keywords: [
    'student portal',
    'Riverside National Senior High School',
    'grade management system',
    'online grading system',
    'school management system',
    'student information system',
    'teacher portal',
    'academic records',
  ],
  applicationName: 'Student Portal',
  authors: [{ name: 'Riverside National Senior High School' }],
  creator: 'Riverside National Senior High School',
  publisher: 'Riverside National Senior High School',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: 'Student Portal',
    description:
      'Riverside National Senior High School Student Portal - Online grade management system for students, teachers, and school administrators.',
    url: 'https://student-portal-demo-site.vercel.app/',
    siteName: 'Student Portal',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.jpg',
        width: 1200,
        height: 630,
        alt: 'Student Portal Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Student Portal',
    description:
      'Riverside National Senior High School Student Portal - Online grade management system.',
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
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}