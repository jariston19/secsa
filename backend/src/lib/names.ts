/** Title-case one name part, e.g. JORYL → Joryl, DELA CRUZ → Dela Cruz */
export function formatDisplayNamePart(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatFullName(firstName: string, lastName: string) {
  return `${formatDisplayNamePart(firstName)} ${formatDisplayNamePart(lastName)}`.trim();
}
