export type DashboardStats = {
  totalStudents: number
  totalTeachers: number
  totalSubjects: number
  totalClasses: number
}

export type GradeLevelChartItem = {
  grade_level: string
  total: number
}

export type TopStudent = {
  student_id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  grade_level: string
  section: string
  average: number
}

export function cleanNamePart(value?: string | null) {
  if (!value) return null

  const trimmed = value.trim()

  if (
    trimmed === '' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined'
  ) {
    return null
  }

  return trimmed
}

export function formatFullName(data: {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  suffix?: string | null
}) {
  return [
    cleanNamePart(data.first_name),
    cleanNamePart(data.middle_name),
    cleanNamePart(data.last_name),
    cleanNamePart(data.suffix),
  ]
    .filter(Boolean)
    .join(' ')
}