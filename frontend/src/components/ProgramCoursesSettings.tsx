import { FormEvent, useEffect, useState } from "react";
import { usePagination } from "../hooks/usePagination";
import { api } from "../lib/api";
import { usePrograms } from "../lib/programs";
import { previewProgramSlug, type ProgramRecord } from "../lib/programCourse";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import { useConfirm } from "../lib/confirm";

interface Props {
  token: string | null;
  onCreated: (message: string, isError?: boolean) => void;
}

type EditDraft = {
  label: string;
  abbr: string;
};

export default function ProgramCoursesSettings({ token, onCreated }: Props) {
  const confirm = useConfirm();
  const { programs, refresh, upsertProgram, removeProgram } = usePrograms();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ label: "", abbr: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const {
    page,
    setPage,
    totalPages,
    paginatedItems,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(programs, {
    resetKey: programs.map((program) => program.id).join(","),
  });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startEdit(program: ProgramRecord) {
    setEditingId(program.id);
    setEditDraft({ label: program.label, abbr: program.abbr });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const label = form.label.trim();
    try {
      const { program } = await api<{ program: ProgramRecord }>(
        "/programs",
        {
          method: "POST",
          body: JSON.stringify({
            label,
            abbr: form.abbr.trim(),
          }),
        },
        token
      );
      setForm({ label: "", abbr: "" });
      upsertProgram(program);
      await refresh();
      onCreated(`Added program course: ${label}.`);
    } catch (err) {
      onCreated(err instanceof Error ? err.message : "Failed to add program course.", true);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    setSavingId(id);
    try {
      const { program } = await api<{ program: ProgramRecord }>(
        `/programs/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: editDraft.label.trim(),
            abbr: editDraft.abbr.trim(),
          }),
        },
        token
      );
      cancelEdit();
      upsertProgram(program);
      await refresh();
      onCreated("Program course updated.");
    } catch (err) {
      onCreated(err instanceof Error ? err.message : "Failed to update program course.", true);
    } finally {
      setSavingId(null);
    }
  }

  async function handleRemoveProgram(program: ProgramRecord) {
    const confirmed = await confirm({
      title: "Remove program?",
      message: `Remove ${program.label} (${program.abbr})? This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Remove",
    });
    if (!confirmed) return;

    setDeletingId(program.id);
    try {
      await api(`/programs/${program.id}`, { method: "DELETE" }, token);
      if (editingId === program.id) cancelEdit();
      removeProgram(program.id);
      await refresh();
      onCreated(`Removed program course: ${program.label}.`);
    } catch (err) {
      onCreated(err instanceof Error ? err.message : "Failed to remove program course.", true);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="add-user-page">
      <div className="add-user-card card">
        <header className="add-user-header">
          <h1>Program Courses</h1>
          <p className="muted section-desc">
            Define the programs offered at your school. New programs appear in user enrollment,
            subject linking, exam sets, and analytics filters.
          </p>
        </header>

        <form className="add-user-form" onSubmit={handleSubmit}>
          <section className="add-user-section">
            <h2 className="add-user-section-title">Add program</h2>
            <div className="add-user-fields add-user-fields-2">
              <label>
                Full name
                <input
                  placeholder="e.g. Chemical Engineering"
                  value={form.label}
                  onChange={(event) => setForm({ ...form, label: event.target.value })}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Abbreviation
                <input
                  placeholder="e.g. CHE"
                  value={form.abbr}
                  onChange={(event) =>
                    setForm({ ...form, abbr: event.target.value.toUpperCase() })
                  }
                  required
                  minLength={2}
                  maxLength={12}
                  pattern="[A-Za-z0-9]+"
                  title="Letters and numbers only"
                />
                <span className="field-hint">Shown in tables and charts (2–12 characters).</span>
              </label>
            </div>
          </section>

          <div className="add-user-actions">
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add program course"}
            </button>
          </div>
        </form>

        <section className="add-user-section program-courses-list-section">
          <h2 className="add-user-section-title">Existing programs</h2>
          {programs.length === 0 ? (
            <p className="muted">No program courses yet.</p>
          ) : (
            <div className="program-courses-list-panel">
              <ListPanel
                footer={
                  <ModalPagination
                    itemNoun="program course"
                    page={page}
                    totalPages={totalPages}
                    pageStart={pageStart}
                    pageEnd={pageEnd}
                    totalItems={totalItems}
                    onPageChange={setPage}
                  />
                }
              >
                <div className="program-courses-table-wrap table-wrap">
                <table className="data-table program-courses-table">
                  <thead>
                    <tr>
                      <th>Abbreviation</th>
                      <th>Program name</th>
                      <th>Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((program) => {
                      const isEditing = editingId === program.id;

                      return (
                        <tr key={program.id}>
                          <td>
                            {isEditing ? (
                              <input
                                className="table-input table-input-narrow"
                                value={editDraft?.abbr ?? ""}
                                onChange={(event) =>
                                  setEditDraft((draft) =>
                                    draft
                                      ? { ...draft, abbr: event.target.value.toUpperCase() }
                                      : draft
                                  )
                                }
                                maxLength={12}
                                pattern="[A-Za-z0-9]+"
                                required
                              />
                            ) : (
                              <span className="program-courses-abbr">{program.abbr}</span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="table-input"
                                value={editDraft?.label ?? ""}
                                onChange={(event) =>
                                  setEditDraft((draft) =>
                                    draft ? { ...draft, label: event.target.value } : draft
                                  )
                                }
                                required
                                minLength={2}
                              />
                            ) : (
                              program.label
                            )}
                          </td>
                          <td>
                            <code className="program-courses-code">
                              {isEditing
                                ? previewProgramSlug(editDraft?.label ?? "") || program.slug
                                : program.slug}
                            </code>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    disabled={savingId === program.id}
                                    onClick={() => saveEdit(program.id)}
                                  >
                                    {savingId === program.id ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn secondary btn-sm"
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn secondary btn-sm"
                                    onClick={() => startEdit(program)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn secondary btn-sm danger"
                                    disabled={deletingId === program.id}
                                    onClick={() => handleRemoveProgram(program)}
                                  >
                                    {deletingId === program.id ? "Removing…" : "Remove"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </ListPanel>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
