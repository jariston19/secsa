export type GenderId = "MALE" | "FEMALE";
export type SchoolTypeId = "PUBLIC" | "PRIVATE";
export type SeniorHighStrandId =
  | "STEM"
  | "ABM"
  | "HUMSS"
  | "GAS"
  | "TVL"
  | "SPORTS"
  | "ARTS_AND_DESIGN";

export const GENDER_OPTIONS: Array<{ id: GenderId; label: string }> = [
  { id: "MALE", label: "Male" },
  { id: "FEMALE", label: "Female" },
];

export const SCHOOL_TYPE_OPTIONS: Array<{ id: SchoolTypeId; label: string }> = [
  { id: "PUBLIC", label: "Public" },
  { id: "PRIVATE", label: "Private" },
];

export const SENIOR_HIGH_STRAND_OPTIONS: Array<{ id: SeniorHighStrandId; label: string }> = [
  { id: "STEM", label: "STEM" },
  { id: "ABM", label: "ABM (Accountancy, Business & Management)" },
  { id: "HUMSS", label: "HUMSS (Humanities & Social Sciences)" },
  { id: "GAS", label: "GAS (General Academic Strand)" },
  { id: "TVL", label: "TVL (Technical-Vocational-Livelihood)" },
  { id: "SPORTS", label: "Sports" },
  { id: "ARTS_AND_DESIGN", label: "Arts and Design" },
];

export function formatGender(value: GenderId | null | undefined) {
  return GENDER_OPTIONS.find((option) => option.id === value)?.label ?? "—";
}

export function formatSchoolType(value: SchoolTypeId | null | undefined) {
  return SCHOOL_TYPE_OPTIONS.find((option) => option.id === value)?.label ?? "—";
}

export function formatSeniorHighStrand(value: SeniorHighStrandId | null | undefined) {
  return SENIOR_HIGH_STRAND_OPTIONS.find((option) => option.id === value)?.label ?? "—";
}
