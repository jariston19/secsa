type BulkDeleteResult = {
  deleted: number;
  archivedSets?: number;
  failed?: Array<{ id: string; error: string }>;
};

export function formatBulkDeleteMessage(
  entityLabel: string,
  result: BulkDeleteResult,
  scopeLabel?: string
) {
  const scope = scopeLabel ? ` for ${scopeLabel}` : "";
  let message = `Deleted ${result.deleted} ${result.deleted === 1 ? entityLabel : `${entityLabel}s`}${scope}.`;

  if (result.archivedSets && result.archivedSets > 0) {
    message += ` ${result.archivedSets} deployed question set(s) were archived.`;
  }

  if (result.failed && result.failed.length > 0) {
    const preview = result.failed
      .slice(0, 2)
      .map((row) => row.error)
      .join(" ");
    message += ` ${result.failed.length} could not be deleted.${preview ? ` ${preview}` : ""}`;
  }

  return message;
}
