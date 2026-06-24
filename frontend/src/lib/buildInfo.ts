export const APP_PUBLISHED_AT = __SECSA_PUBLISHED_AT__;
export const APP_BUILD_MODIFIED_AT = __SECSA_BUILD_MODIFIED_AT__;
export const APP_AUTHOR = "Josiah P. Ariston";

export function formatAppDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}
