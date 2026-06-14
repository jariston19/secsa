function capitalizeEntity(entity: string) {
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}

export function quoteLabel(label: string) {
  return `"${label.trim()}"`;
}

export function truncateLabel(text: string, max = 72) {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

export function subjectLabel(courseCode: string, courseTitle: string) {
  return `${courseCode} - ${courseTitle}`;
}

export function toastCreated(entity: string, label: string, extra?: string) {
  const message = `Created ${capitalizeEntity(entity)} ${quoteLabel(label)}.`;
  return extra ? `${message} ${extra}` : message;
}

export function toastUpdated(entity: string, label: string, extra?: string) {
  const message = `Updated ${capitalizeEntity(entity)} ${quoteLabel(label)}.`;
  return extra ? `${message} ${extra}` : message;
}

export function toastDeleted(entity: string, label: string, extra?: string) {
  const message = `Deleted ${capitalizeEntity(entity)} ${quoteLabel(label)}.`;
  return extra ? `${message} ${extra}` : message;
}

export function toastDeployed(entity: string, label: string) {
  return `Deployed ${capitalizeEntity(entity)} ${quoteLabel(label)}.`;
}

export function toastUndeployed(entity: string, label: string) {
  return `Deploy cancelled for ${capitalizeEntity(entity)} ${quoteLabel(label)}. It is back in draft.`;
}

export function toastArchived(entity: string, label: string) {
  return `Archived ${capitalizeEntity(entity)} ${quoteLabel(label)}.`;
}

export function toastRestored(entity: string, label: string) {
  return `Restored ${capitalizeEntity(entity)} ${quoteLabel(label)} to draft.`;
}

export function toastLinked(entity: string, label: string, detail: string) {
  return `Updated ${capitalizeEntity(entity)} ${quoteLabel(label)}. ${detail}`;
}

export function toastBatchCreated(
  entityPlural: string,
  count: number,
  contextLabel: string,
  extra?: string
) {
  const noun = count === 1 ? entityPlural.replace(/s$/, "") : entityPlural;
  let message = `Created ${count} ${noun} for ${quoteLabel(contextLabel)}.`;
  if (extra) message += ` ${extra}`;
  return message;
}

export function toastRemoved(entity: string, label: string, context?: string) {
  const message = `Removed ${capitalizeEntity(entity)} ${quoteLabel(label)}`;
  return context ? `${message} from ${quoteLabel(context)}.` : `${message}.`;
}

export function toastApproved(action: string, label: string) {
  return `Approved ${action} for ${quoteLabel(label)}.`;
}
