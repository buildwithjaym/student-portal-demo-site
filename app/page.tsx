import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Image from 'next/image'

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
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 40 }}>
      
      {/* Logo */}
      <div style={{ marginBottom: 20 }}>
        <Image
          src="/logo.jpg"
          alt="Riverside National Senior High School Student Portal Logo"
          width={120}
          height={120}
        />
      </div>

      {/* Title */}
      <h1>Student Portal</h1>

      {/* Description */}
      <p>
        The Riverside National Senior High School Student Portal is a modern online system designed for students,
        teachers, and school administrators. It provides secure access to academic records, grades, and performance tracking.
      </p>

      {/* Features */}
      <h2>Key Features</h2>
      <ul>
        <li>Student grade viewing system</li>
        <li>Teacher class and grade management</li>
        <li>Secure login for students and staff</li>
        <li>Centralized student information system</li>
      </ul>

      {/* Audience */}
      <h2>Who is it for?</h2>
      <p>
        This Student Portal is built for Riverside National Senior High School students, teachers, and administrators to manage academic records efficiently.
      </p>

    </main>
  )
}