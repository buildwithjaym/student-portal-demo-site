export function formatFullName({
  first_name,
  middle_name,
  last_name,
  suffix,
}: {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  suffix?: string | null
}) {
  return [
    first_name?.trim(),
    middle_name?.trim(),
    last_name?.trim(),
    suffix?.trim(),
  ]
    .filter(Boolean)
    .join(' ')
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
