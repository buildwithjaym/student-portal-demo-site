import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''

  const isBot =
    userAgent.includes('Googlebot') ||
    userAgent.includes('Bingbot') ||
    userAgent.includes('Slurp')

  if (!isBot) {
    redirect('/login')
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Qorban Portal</h1>
      <p>
        Online grade portal for students, teachers, and school administrators.
      </p>
    </main>
  )
}