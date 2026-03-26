'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  BookOpen,
  Globe,
  GraduationCap,
  IdCard,
  Mail,
  MapPin,
  Phone,
  School,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'

type Teacher = {
  id: string
  teacher_no: string
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  email?: string
  phone?: string
  address?: string
}

const PRAISES = [
  "You’re doing an amazing job shaping the future.",
  "Your dedication inspires your students every day.",
  "Great teachers like you change lives.",
  "Your passion for teaching truly matters.",
  "Keep up the incredible work!",
  "Your effort is making a real difference.",
]

export default function ProfilePage() {
  const router = useRouter()

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState(0)

  // 🔥 Load profile
  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('teachers')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      if (data) {
        setTeacher(data)
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  // 🔥 Motivation logic
  useEffect(() => {
    const lastShown = localStorage.getItem('motivation_last_shown')
    const now = Date.now()

    if (!lastShown) {
      setShowModal(true)
      localStorage.setItem('motivation_last_shown', now.toString())
      return
    }

    const diff = now - Number(lastShown)

    if (diff > 10 * 60 * 1000) {
      setShowModal(true)
      localStorage.setItem('motivation_last_shown', now.toString())
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="text-center text-red-500">Profile not found</div>
    )
  }

  const fullName = formatFullName(teacher)

  return (
    <>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="rounded-3xl bg-gradient-to-r from-green-900 to-green-700 p-6 text-white shadow-xl">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-green-100">
            Manage your teacher information
          </p>
        </div>

        {/* PROFILE CARD */}
        <div className="rounded-3xl bg-white p-6 shadow-md border">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
              <UserRound className="h-8 w-8 text-green-800" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-green-900">
                {fullName}
              </h2>
              <p className="text-sm text-gray-600">
                Teacher No: {teacher.teacher_no}
              </p>
            </div>
          </div>

          {/* DETAILS */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Info icon={<Mail />} label="Email" value={teacher.email} />
            <Info icon={<Phone />} label="Phone" value={teacher.phone} />
            <Info icon={<MapPin />} label="Address" value={teacher.address} />
            <Info icon={<School />} label="Department" value="Senior High" />
          </div>
        </div>

        {/* SOCIAL */}
        <div className="rounded-3xl bg-white p-6 shadow-md border">
          <h3 className="mb-4 font-bold text-green-900">Social</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <Info icon={<Globe />} label="Website" value="Not set" />
            <Info icon={<Globe />} label="Facebook" value="Not set" />
          </div>
        </div>
      </div>

      {/* 🎉 MOTIVATION MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <div className="flex justify-between">
                <h2 className="font-bold text-green-900">
                  💚 For You, Teacher
                </h2>

                <button onClick={() => setShowModal(false)}>
                  <X />
                </button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-lg font-semibold text-gray-800">
                  {PRAISES[(step + Math.floor(Math.random() * PRAISES.length)) % PRAISES.length]}
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  You did a very good job,Teacher  {teacher.first_name}!
                </p>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  disabled={step === 0}
                  onClick={() => setStep((s) => s - 1)}
                  className="text-sm text-gray-500 disabled:opacity-30"
                >
                  Back
                </button>

                {step < 2 ? (
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    className="rounded-xl bg-green-800 px-4 py-2 text-white"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowModal(false)
                      toast.success('Keep inspiring your students!')
                    }}
                    className="rounded-xl bg-green-800 px-4 py-2 text-white"
                  >
                    Finish
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// 🔹 Reusable component
function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="text-green-800">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800">
          {value || 'Not provided'}
        </p>
      </div>
    </div>
  )
}