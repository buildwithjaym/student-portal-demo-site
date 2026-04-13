import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Semester = '1st Semester' | '2nd Semester'
type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'
type ReportType = 'class_list_only' | 'class_list_with_grades' | 'attendance_sheet'

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
}

type TeacherRow = {
  id: string
  teacher_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
}

type StudentRow = {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  gender: 'Male' | 'Female' | null
}

type GradeRow = {
  student_id: string
  grade: number
  remarks: string | null
}

type ReportRow = {
  student_id: string
  full_name: string
  gender: string
  grade: string
  remarks: string
  last_name_sort: string
  first_name_sort: string
}

function isValidGradingPeriod(value: string | null): value is GradingPeriod {
  return value === '1st' || value === '2nd' || value === '3rd' || value === '4th'
}

function isValidReportType(value: string | null): value is ReportType {
  return (
    value === 'class_list_only' ||
    value === 'class_list_with_grades' ||
    value === 'attendance_sheet'
  )
}

function getSemesterFromPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function getMiddleInitial(name?: string | null) {
  if (!name?.trim()) return ''
  return `${name.trim().charAt(0).toUpperCase()}.`
}

function getFullName(
  lastName?: string | null,
  firstName?: string | null,
  middleName?: string | null,
  suffix?: string | null
) {
  const mi = getMiddleInitial(middleName)
  const base = `${lastName ?? ''}, ${firstName ?? ''}${mi ? ` ${mi}` : ''}`.trim()
  return suffix?.trim() ? `${base} ${suffix.trim()}` : base
}

function getTeacherName(teacher: TeacherRow | null) {
  if (!teacher) return 'Teacher'
  return [teacher.first_name, teacher.middle_name, teacher.last_name, teacher.suffix]
    .filter(Boolean)
    .join(' ')
}

function getHonorLabel(grade?: number | null) {
  if (grade === null || grade === undefined || Number.isNaN(Number(grade))) {
    return 'No Grade'
  }

  const value = Number(grade)

  if (value < 75) return 'Failed'
  if (value <= 89) return 'Passed'
  if (value <= 94) return 'With Honors'
  if (value <= 98) return 'With High Honors'
  if (value <= 100) return 'With Highest Honors'
  return 'Invalid Grade'
}

function getReportTitle(reportType: ReportType) {
  if (reportType === 'class_list_only') return 'Official Class List'
  if (reportType === 'class_list_with_grades') return 'Official Class List with Grades'
  return 'Official Attendance Sheet'
}

function getGenderSortValue(gender: string) {
  if (gender === 'Male') return 0
  if (gender === 'Female') return 1
  return 2
}

function getSingleRelation<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function safeText(value: string, max = 80) {
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max - 3)}...` : value
}

function formatDate() {
  return new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function fileNamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '_')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const classId = searchParams.get('classId')
    const schoolYear = searchParams.get('schoolYear')
    const gradingPeriodParam = searchParams.get('gradingPeriod')
    const reportTypeParam = searchParams.get('reportType')

    if (!classId || !schoolYear || !gradingPeriodParam || !reportTypeParam) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (!isValidGradingPeriod(gradingPeriodParam)) {
      return NextResponse.json({ error: 'Invalid grading period' }, { status: 400 })
    }

    if (!isValidReportType(reportTypeParam)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    const gradingPeriod: GradingPeriod = gradingPeriodParam
    const reportType: ReportType = reportTypeParam
    const semester = getSemesterFromPeriod(gradingPeriod)

    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select(`
        id,
        subject_id,
        teacher_id,
        grade_level,
        section,
        school_year,
        semester,
        is_active,
        subjects:subject_id (
          id,
          subject_code,
          subject_name
        ),
        teachers:teacher_id (
          id,
          teacher_no,
          first_name,
          middle_name,
          last_name,
          suffix
        )
      `)
      .eq('id', classId)
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .maybeSingle()

    if (classError) {
      return NextResponse.json({ error: classError.message }, { status: 500 })
    }

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    const selectedClass = classData as {
      id: string
      subject_id: string
      teacher_id: string | null
      grade_level: 'Grade 11' | 'Grade 12'
      section: string
      school_year: string
      semester: Semester
      is_active: boolean
      subjects: SubjectRow[] | SubjectRow | null
      teachers: TeacherRow[] | TeacherRow | null
    }

    const subject = getSingleRelation<SubjectRow>(selectedClass.subjects)
    const teacher = getSingleRelation<TeacherRow>(selectedClass.teachers)

    const [enrollmentsResult, gradesResult] = await Promise.all([
      supabaseAdmin
        .from('enrollments')
        .select(`
          student_id,
          students:student_id (
            id,
            first_name,
            middle_name,
            last_name,
            suffix,
            gender
          )
        `)
        .eq('class_id', classId)
        .eq('school_year', schoolYear)
        .eq('semester', semester),
      supabaseAdmin
        .from('grades')
        .select('student_id, grade, remarks')
        .eq('class_id', classId)
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .eq('grading_period', gradingPeriod),
    ])

    if (enrollmentsResult.error) {
      return NextResponse.json({ error: enrollmentsResult.error.message }, { status: 500 })
    }

    if (gradesResult.error) {
      return NextResponse.json({ error: gradesResult.error.message }, { status: 500 })
    }

    const enrollments = (enrollmentsResult.data ?? []) as Array<{
      student_id: string
      students: StudentRow[] | StudentRow | null
    }>

    const grades = (gradesResult.data ?? []) as GradeRow[]

    const gradeMap = new Map<string, GradeRow>()
    for (const item of grades) {
      gradeMap.set(item.student_id, item)
    }

    const rows: ReportRow[] = enrollments
      .map((item) => ({
        student_id: item.student_id,
        student: getSingleRelation<StudentRow>(item.students),
      }))
      .filter(
        (item): item is { student_id: string; student: StudentRow } => item.student !== null
      )
      .map((item) => {
        const student = item.student
        const gradeRow = gradeMap.get(student.id)
        const numericGrade =
          gradeRow?.grade !== undefined && gradeRow?.grade !== null
            ? Number(gradeRow.grade)
            : null

        return {
          student_id: student.id,
          full_name: getFullName(
            student.last_name,
            student.first_name,
            student.middle_name,
            student.suffix
          ),
          gender: student.gender ?? '—',
          grade: numericGrade !== null ? String(numericGrade) : '',
          remarks: gradeRow?.remarks?.trim() || getHonorLabel(numericGrade),
          last_name_sort: (student.last_name ?? '').trim().toLowerCase(),
          first_name_sort: (student.first_name ?? '').trim().toLowerCase(),
        }
      })
      .sort((a, b) => {
        const genderCompare = getGenderSortValue(a.gender) - getGenderSortValue(b.gender)
        if (genderCompare !== 0) return genderCompare

        const lastNameCompare = a.last_name_sort.localeCompare(b.last_name_sort)
        if (lastNameCompare !== 0) return lastNameCompare

        return a.first_name_sort.localeCompare(b.first_name_sort)
      })

    const numericGrades = rows
      .map((row) => Number(row.grade))
      .filter((value) => !Number.isNaN(value))

    const averageGrade =
      numericGrades.length > 0
        ? (numericGrades.reduce((sum, value) => sum + value, 0) / numericGrades.length).toFixed(2)
        : '—'

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let page = pdfDoc.addPage([595.28, 841.89])
    let { width, height } = page.getSize()
    const marginX = 40
    const rowHeight = 20
    let y = height - 40

    const addPage = () => {
      page = pdfDoc.addPage([595.28, 841.89])
      const size = page.getSize()
      width = size.width
      height = size.height
      y = height - 40
    }

    const ensureSpace = (needed = 24) => {
      if (y - needed < 45) addPage()
    }

    const drawText = (
      text: string,
      x: number,
      currentY: number,
      size = 10,
      bold = false
    ) => {
      page.drawText(text, {
        x,
        y: currentY,
        size,
        font: bold ? fontBold : font,
        color: rgb(0, 0, 0),
      })
    }

    const drawHeader = () => {
      drawText('Republic of the Philippines', marginX, y, 9)
      y -= 14
      drawText('Department of Education', marginX, y, 11, true)
      y -= 18
      drawText(
        'Qorban Institute of Technology Training and Assessment Center, Inc',
        marginX,
        y,
        13,
        true
      )
      y -= 20
      drawText(getReportTitle(reportType), marginX, y, 11, true)
      y -= 20

      page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 1,
        color: rgb(0.75, 0.75, 0.75),
      })
      y -= 16

      drawText(`Teacher: ${getTeacherName(teacher)}`, marginX, y, 10)
      drawText(`Teacher No: ${teacher?.teacher_no ?? '—'}`, 320, y, 10)
      y -= 16
      drawText(`Academic Year: ${schoolYear}`, marginX, y, 10)
      drawText(`Period: ${gradingPeriod} Grading Period`, 320, y, 10)
      y -= 16
      drawText(
        `Subject: ${safeText(
          `${subject?.subject_code ?? '—'} - ${subject?.subject_name ?? 'Unnamed Subject'}`,
          48
        )}`,
        marginX,
        y,
        10
      )
      y -= 16
      drawText(
        `Grade / Section: ${selectedClass.grade_level} / ${selectedClass.section}`,
        marginX,
        y,
        10
      )
      drawText(`Semester: ${semester}`, 320, y, 10)
      y -= 16
      drawText(`Date Generated: ${formatDate()}`, marginX, y, 10)

      if (reportType === 'class_list_with_grades') {
        drawText(`Average Grade: ${averageGrade}`, 320, y, 10, true)
      }

      y -= 20
    }

    const drawTableHeader = () => {
      const startX = marginX
      const totalWidth = width - marginX * 2

      if (reportType === 'attendance_sheet') {
        const colNo = 35
        const colName = 210
        const colAttendance = (totalWidth - colNo - colName) / 10

        page.drawRectangle({
          x: startX,
          y: y - rowHeight + 5,
          width: totalWidth,
          height: rowHeight,
          color: rgb(0.92, 0.97, 0.94),
          borderWidth: 1,
          borderColor: rgb(0.7, 0.7, 0.7),
        })

        drawText('No.', startX + 10, y - 13, 9, true)
        drawText('Full Name', startX + colNo + 8, y - 13, 9, true)

        for (let i = 0; i < 10; i++) {
          const x = startX + colNo + colName + i * colAttendance
          page.drawLine({
            start: { x, y: y - rowHeight + 5 },
            end: { x, y: y + 5 },
            thickness: 1,
            color: rgb(0.7, 0.7, 0.7),
          })
        }

        y -= rowHeight
        return
      }

      if (reportType === 'class_list_only') {
        const colNo = 35
        const colName = 330

        page.drawRectangle({
          x: startX,
          y: y - rowHeight + 5,
          width: totalWidth,
          height: rowHeight,
          color: rgb(0.92, 0.97, 0.94),
          borderWidth: 1,
          borderColor: rgb(0.7, 0.7, 0.7),
        })

        drawText('No.', startX + 10, y - 13, 9, true)
        drawText('Full Name', startX + colNo + 8, y - 13, 9, true)
        drawText('Gender', startX + colNo + colName + 8, y - 13, 9, true)

        page.drawLine({
          start: { x: startX + colNo, y: y - rowHeight + 5 },
          end: { x: startX + colNo, y: y + 5 },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.7),
        })

        page.drawLine({
          start: { x: startX + colNo + colName, y: y - rowHeight + 5 },
          end: { x: startX + colNo + colName, y: y + 5 },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.7),
        })

        y -= rowHeight
        return
      }

      const colNo = 35
      const colName = 220
      const colGender = 70
      const colGrade = 60
      const colRemarks = totalWidth - colNo - colName - colGender - colGrade

      page.drawRectangle({
        x: startX,
        y: y - rowHeight + 5,
        width: totalWidth,
        height: rowHeight,
        color: rgb(0.92, 0.97, 0.94),
        borderWidth: 1,
        borderColor: rgb(0.7, 0.7, 0.7),
      })

      drawText('No.', startX + 10, y - 13, 9, true)
      drawText('Full Name', startX + colNo + 8, y - 13, 9, true)
      drawText('Gender', startX + colNo + colName + 8, y - 13, 9, true)
      drawText('Grade', startX + colNo + colName + colGender + 8, y - 13, 9, true)
      drawText('Remarks', startX + colNo + colName + colGender + colGrade + 8, y - 13, 9, true)

      const xs = [
        startX + colNo,
        startX + colNo + colName,
        startX + colNo + colName + colGender,
        startX + colNo + colName + colGender + colGrade,
      ]

      for (const x of xs) {
        page.drawLine({
          start: { x, y: y - rowHeight + 5 },
          end: { x, y: y + 5 },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.7),
        })
      }

      void colRemarks
      y -= rowHeight
    }

    const drawRow = (row: ReportRow, index: number) => {
      const startX = marginX
      const totalWidth = width - marginX * 2

      if (reportType === 'attendance_sheet') {
        const colNo = 35
        const colName = 210
        const colAttendance = (totalWidth - colNo - colName) / 10

        page.drawRectangle({
          x: startX,
          y: y - rowHeight + 5,
          width: totalWidth,
          height: rowHeight,
          borderWidth: 1,
          borderColor: rgb(0.82, 0.82, 0.82),
        })

        drawText(String(index + 1), startX + 10, y - 13, 9)
        drawText(safeText(row.full_name, 34), startX + colNo + 8, y - 13, 9)

        for (let i = 0; i < 10; i++) {
          const x = startX + colNo + colName + i * colAttendance
          page.drawLine({
            start: { x, y: y - rowHeight + 5 },
            end: { x, y: y + 5 },
            thickness: 1,
            color: rgb(0.82, 0.82, 0.82),
          })
        }

        y -= rowHeight
        return
      }

      if (reportType === 'class_list_only') {
        const colNo = 35
        const colName = 330

        page.drawRectangle({
          x: startX,
          y: y - rowHeight + 5,
          width: totalWidth,
          height: rowHeight,
          borderWidth: 1,
          borderColor: rgb(0.82, 0.82, 0.82),
        })

        drawText(String(index + 1), startX + 10, y - 13, 9)
        drawText(safeText(row.full_name, 52), startX + colNo + 8, y - 13, 9)
        drawText(row.gender || '—', startX + colNo + colName + 8, y - 13, 9)

        page.drawLine({
          start: { x: startX + colNo, y: y - rowHeight + 5 },
          end: { x: startX + colNo, y: y + 5 },
          thickness: 1,
          color: rgb(0.82, 0.82, 0.82),
        })

        page.drawLine({
          start: { x: startX + colNo + colName, y: y - rowHeight + 5 },
          end: { x: startX + colNo + colName, y: y + 5 },
          thickness: 1,
          color: rgb(0.82, 0.82, 0.82),
        })

        y -= rowHeight
        return
      }

      const colNo = 35
      const colName = 220
      const colGender = 70
      const colGrade = 60

      page.drawRectangle({
        x: startX,
        y: y - rowHeight + 5,
        width: totalWidth,
        height: rowHeight,
        borderWidth: 1,
        borderColor: rgb(0.82, 0.82, 0.82),
      })

      drawText(String(index + 1), startX + 10, y - 13, 9)
      drawText(safeText(row.full_name, 34), startX + colNo + 8, y - 13, 9)
      drawText(row.gender || '—', startX + colNo + colName + 8, y - 13, 9)
      drawText(row.grade || '—', startX + colNo + colName + colGender + 8, y - 13, 9)
      drawText(
        safeText(row.remarks || '—', 24),
        startX + colNo + colName + colGender + colGrade + 8,
        y - 13,
        9
      )

      const xs = [
        startX + colNo,
        startX + colNo + colName,
        startX + colNo + colName + colGender,
        startX + colNo + colName + colGender + colGrade,
      ]

      for (const x of xs) {
        page.drawLine({
          start: { x, y: y - rowHeight + 5 },
          end: { x, y: y + 5 },
          thickness: 1,
          color: rgb(0.82, 0.82, 0.82),
        })
      }

      y -= rowHeight
    }

    drawHeader()
    drawTableHeader()

    if (rows.length === 0) {
      ensureSpace(30)
      drawText('No report data found for this selection.', marginX, y, 10)
      y -= 22
    } else {
      for (let index = 0; index < rows.length; index++) {
        if (y < 90) {
          addPage()
          drawHeader()
          drawTableHeader()
        }
        drawRow(rows[index], index)
      }
    }

    y -= 20
    ensureSpace(60)

    drawText('Prepared by:', marginX, y, 10)
    y -= 32
    drawText(getTeacherName(teacher), marginX, y, 10, true)
    y -= 14
    drawText('Subject Teacher', marginX, y, 9)

    const savedPdf = await pdfDoc.save()
const pdfBytes = new Uint8Array(savedPdf)

const subjectCode = subject?.subject_code ?? 'report'
const reportFileName = `${fileNamePart(subjectCode)}-${fileNamePart(reportType)}-${fileNamePart(classId)}.pdf`

return new Response(pdfBytes, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${reportFileName}"`,
    'Cache-Control': 'no-store',
  },
})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}