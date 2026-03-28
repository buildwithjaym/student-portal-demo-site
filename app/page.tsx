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
          alt="Qorban Portal Logo"
          width={120}
          height={120}
        />
      </div>

      {/* Title */}
      <h1>Qorban Portal - Online Grade Management System</h1>

      {/* Description */}
      <p>
        Qorban Portal is a modern online student portal designed for schools,
        teachers, and students. It allows secure access to grades, academic
        records, and performance tracking.
      </p>

      {/* Features */}
      <h2>Key Features</h2>
      <ul>
        <li>Student grade tracking system</li>
        <li>Teacher dashboard for managing classes</li>
        <li>Secure login for students and staff</li>
        <li>Online school management portal</li>
      </ul>

      {/* Audience */}
      <h2>Who is it for?</h2>
      <p>
        This platform is built for schools, universities, and educational
        institutions looking for a reliable student information system and
        grading solution.
      </p>

    </main>
  )
}