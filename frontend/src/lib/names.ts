export function formatFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

export function compareByName(
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string }
) {
  const last = a.lastName.localeCompare(b.lastName);
  return last !== 0 ? last : a.firstName.localeCompare(b.firstName);
}
