export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export function findDuplicateUserEmail<
  T extends { id: string; email: string; firstName: string; lastName: string },
>(users: T[], email: string, excludeId?: string) {
  const normalizedEmail = normalizeUserEmail(email);
  if (!normalizedEmail) return null;

  return (
    users.find(
      (user) => user.id !== excludeId && normalizeUserEmail(user.email) === normalizedEmail
    ) ?? null
  );
}

export function duplicateUserEmailMessage<
  T extends { email: string; firstName: string; lastName: string },
>(duplicate: T) {
  return `This email is already used by ${duplicate.firstName} ${duplicate.lastName} (${duplicate.email}).`;
}
