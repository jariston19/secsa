export function formatFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

/** Display name in title case, e.g. JORYL CAMPOS → Joryl Campos */
export function formatDisplayNamePart(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatDisplayFullName(firstName: string, lastName: string) {
  return formatFullName(formatDisplayNamePart(firstName), formatDisplayNamePart(lastName));
}

export function compareByName(
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string }
) {
  const last = a.lastName.localeCompare(b.lastName);
  return last !== 0 ? last : a.firstName.localeCompare(b.firstName);
}
