export type GenderId = "MALE" | "FEMALE";
export type SchoolTypeId = "PUBLIC" | "PRIVATE";

export const GENDER_OPTIONS: Array<{ id: GenderId; label: string }> = [
  { id: "MALE", label: "Male" },
  { id: "FEMALE", label: "Female" },
];

export const SCHOOL_TYPE_OPTIONS: Array<{ id: SchoolTypeId; label: string }> = [
  { id: "PUBLIC", label: "Public" },
  { id: "PRIVATE", label: "Private" },
];

export function formatGender(value: GenderId | null | undefined) {
  return GENDER_OPTIONS.find((option) => option.id === value)?.label ?? "—";
}

export function formatSchoolType(value: SchoolTypeId | null | undefined) {
  return SCHOOL_TYPE_OPTIONS.find((option) => option.id === value)?.label ?? "—";
}
