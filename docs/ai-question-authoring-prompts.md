# AI Question Authoring Prompts for SECSA

Use these prompts in ChatGPT, Claude, or similar tools when drafting MCQs for entry into SECSA. Copy the **Master context** once per chat session, then use the task-specific prompts below.

**Audience:** Teachers and subject coordinators  
**Related:** [Question guidelines & analytics outline](./question-guidelines-and-analytics-outline.md)

---

## Quick reference — SECSA fields

Every question in SECSA needs these fields:

| Field | Values / format |
|-------|-----------------|
| **subject** | Course code + title (e.g. `ACEE 106 Electromagnetics`) |
| **topic** | Unit name (optional but recommended for analytics) |
| **difficulty** | `EASY` \| `MEDIUM` \| `HARD` (students see this) |
| **bloomLevel** | `KNOWLEDGE` \| `COMPREHENSION` \| `APPLICATION` \| `ANALYSIS` \| `SYNTHESIS` \| `EVALUATION` |
| **text** | Question stem |
| **optionA–D** | Four options (plain text, no `A)` prefix) |
| **correctOption** | `A` \| `B` \| `C` \| `D` |
| **rationale** | Why the correct answer is correct |
| **distractorNotes** | What mistake each wrong option represents |

### Difficulty ↔ Bloom alignment (SECSA rules)

| Difficulty | Bloom levels | Target correct rate* |
|------------|--------------|----------------------|
| **EASY** | KNOWLEDGE, COMPREHENSION | 70–90% |
| **MEDIUM** | APPLICATION | 40–70% |
| **HARD** | ANALYSIS, SYNTHESIS, EVALUATION | 20–40% |

\*After enough students take the exam — use for calibration, not guessing.

### Exam types

| Type | Purpose |
|------|---------|
| **DIAGNOSTIC** | Incoming year-1 readiness (shared gen-ed across programs) |
| **COMPREHENSIVE** | Previous-year subject retention (program + year specific) |
| **RETAKE** | Separate retake pool |

**Programs:** Civil Engineering, Mechanical Engineering, Electrical Engineering, Information Technology, Architecture

**Pass threshold:** 75% on comprehensive exams (score ÷ total items × 100)

---

## Prompt 1 — Master context (paste first in every chat)

```
You are helping author MCQs for SECSA, a Philippine engineering college retention exam platform.

EXAM TYPES:
- DIAGNOSTIC: incoming year-1 readiness (shared gen-ed across programs)
- COMPREHENSIVE: previous-year subject retention (program + year specific)
- RETAKE: separate retake pool

PROGRAMS: Civil Engineering, Mechanical Engineering, Electrical Engineering, Information Technology, Architecture

REQUIRED FIELDS PER QUESTION (match our database exactly):
- subject: course code + title (e.g. "ACEE 106 Electromagnetics")
- topic: unit name (optional but preferred for analytics)
- difficulty: EASY | MEDIUM | HARD  (students see this label)
- bloomLevel: exactly one of KNOWLEDGE | COMPREHENSION | APPLICATION | ANALYSIS | SYNTHESIS | EVALUATION
- text: question stem
- optionA, optionB, optionC, optionD: four options (plain text, no "A)" prefix)
- correctOption: A | B | C | or D
- rationale: why the correct answer is correct
- distractorNotes: what misconception each wrong option targets

DIFFICULTY ↔ BLOOM ALIGNMENT (our system rules):
- EASY → KNOWLEDGE or COMPREHENSION (target 70–90% correct when calibrated)
- MEDIUM → APPLICATION (target 40–70% correct)
- HARD → ANALYSIS, SYNTHESIS, or EVALUATION (target 20–40% correct)

DISTRACTOR RULES (critical for our analytics):
- Every wrong option must be wrong for a teachable reason (real student mistake)
- Distractors must match the cognitive level of the stem (no L1 throwaways on L4 stems)
- No "all of the above," trick typos, or joke answers
- Avoid double negatives and ambiguous wording
- Each option should be similar length and complexity

PASS THRESHOLD: 75% on comprehensive exams (not per-question)

OUTPUT: Use the batch template below. One question per block. Ready for teachers to copy into SECSA encoder.
```

---

## Prompt 2 — Generate new questions (batch)

Replace bracketed placeholders before sending.

```
Using the SECSA context above, write [NUMBER] MCQs for:

Exam type: [DIAGNOSTIC | COMPREHENSIVE]
Program: [Mechanical Engineering | Civil Engineering | etc. | All Programs for diagnostic]
Year level: [1 | 2 | 3 | 4]
Subject: [e.g. MATH 101 College Algebra]
Topic: [e.g. Quadratic Equations]

Mix: [e.g. 2 EASY, 2 MEDIUM, 1 HARD]

Content scope: [1st-year topics only / senior high readiness / etc.]
Avoid: [topics not yet taught, brand-specific tools, etc.]

For each question use this format:

---
Q[#]
subject:
topic:
difficulty: EASY|MEDIUM|HARD
bloomLevel: KNOWLEDGE|COMPREHENSION|APPLICATION|ANALYSIS|SYNTHESIS|EVALUATION
text:
optionA:
optionB:
optionC:
optionD:
correctOption: A|B|C|D
rationale:
distractorNotes: A=... | B=... | C=... | D=... (mark CORRECT for the key)
---

After all questions, add a short table: Q# | difficulty | bloomLevel | skill tested
```

### Example — incoming diagnostic

```
Using the SECSA context above, write 5 DIAGNOSTIC MCQs for incoming year-1 students across all engineering programs.

Focus on senior-high readiness: English, math, science, logic, study skills.
Program-agnostic stems only. Subject: "DIAGNOSTIC Exam 2026".
Topics should be fine-grained for analytics (e.g. "Fractions", "Reading comprehension").

Mix: 2 EASY, 2 MEDIUM, 1 HARD

Use the standard batch format from the master context.
```

### Example — comprehensive retention

```
Using the SECSA context above, write 10 COMPREHENSIVE MCQs for Mechanical Engineering year-2 students testing year-1 subjects.

Subject: MECH 101 Engineering Mechanics
Topics: Forces, Moments, Equilibrium

Mix: 3 EASY, 5 MEDIUM, 2 HARD

Use the standard batch format from the master context.
```

---

## Prompt 3 — Rewrite a weak question (discrimination / distractor fix)

Use when analytics show low discrimination, negative discrimination, or a tall wrong bar in distractor analysis.

```
Using the SECSA context above, rewrite this underperforming MCQ.

PROBLEM SIGNALS:
- Low discrimination (weak and strong students miss it equally)
- [optional: negative discrimination / top wrong answer was X at Y%]

ORIGINAL:
subject: [...]
topic: [...]
difficulty: [...]
bloomLevel: [...]
text: [...]
optionA: [...]
optionB: [...]
optionC: [...]
optionD: [...]
correctOption: [...]

REWRITE GOALS:
1. Keep the same topic and intended difficulty
2. Fix ambiguous stem and misaligned distractors
3. Make exactly one clearly best answer
4. Make each distractor a plausible mistake from partial understanding
5. Match bloomLevel to actual thinking required

Return:
- revised question in full SECSA field format
- bullet list: what was wrong with the original
- why the new version should discriminate better
```

---

## Prompt 4 — Quality check before entering SECSA

Run this on AI output (or colleague drafts) before encoding in the Teacher dashboard.

```
Review these MCQs against SECSA rules. For each question score 1–5 on:
- stem clarity
- single best answer
- distractor quality (teachable misconceptions)
- difficulty/bloom alignment
- discrimination potential (will strong students outperform weak ones?)

Flag: ambiguous wording, mis-key risk, L1 distractors on hard stems, too easy/hard for label.

Questions:
[paste question blocks here]

Return: PASS / REVISE per question + specific fixes only where REVISE.
```

---

## Prompt 5 — Expand one topic into a balanced set

```
Using the SECSA context above, create a balanced question set for:

Subject: [course code + title]
Topic: [unit name]
Exam type: [DIAGNOSTIC | COMPREHENSIVE]
Count: [e.g. 12 questions]

Requirements:
- Cover sub-skills within the topic evenly
- Mix: ~30% EASY, ~50% MEDIUM, ~20% HARD
- No duplicate stems or near-duplicate concepts
- Each HARD item must require reasoning, not recall-only
- Include distractorNotes for every item

Output in standard SECSA batch format. End with a coverage map: sub-skill → Q numbers.
```

---

## Prompt 6 — One-line shortcut

When you already have context in the chat:

```
SECSA MCQ batch: subject, topic, difficulty (EASY/MEDIUM/HARD), bloomLevel (KNOWLEDGE…EVALUATION), stem, options A–D, correctOption, rationale, distractorNotes. Plausible misconceptions only; no tricks; match Bloom to difficulty. [Add your topic/count here.]
```

---

## Tips for best results

| Do | Don't |
|----|--------|
| Paste **Master context** once per chat | Start mid-thread without SECSA field names |
| Ask for **plain option text** (no `A)` prefix) | Accept "All of the above" or "None of the above" |
| Use **exact enum values** (`APPLICATION`, not "Apply") | Use informal Bloom names that don't match SECSA |
| Request **distractorNotes** on every question | Skip rationale — faculty need it for review |
| Generate **5–10 questions per batch**, then QC | Ask for 50+ at once (quality drops) |
| Run **Prompt 4** before encoding | Paste AI output directly without review |

---

## After AI generation — SECSA entry checklist

- [ ] Subject and topic match your deployed question set
- [ ] `difficulty` and `bloomLevel` align with SECSA rules
- [ ] Options are plain text; `correctOption` is a single letter
- [ ] Stem has one defensible best answer
- [ ] Distractors represent real misconceptions (helps distractor analysis charts)
- [ ] Enter via Teacher → Encode questions (or your saved-questions workflow)
- [ ] After deployment, check **Distractor analysis** and **Discrimination index** in Admin → Analytics

---

## How prompts connect to analytics

| SECSA chart | What good authoring enables |
|-------------|----------------------------|
| **Distractor analysis** | Blue bar = correct option; tall gray bars = misconceptions to teach — only useful if distractors were intentional |
| **Discrimination index** | Top half = question separates strong vs weak students; bottom half = revise item |
| **Correct rate vs expected difficulty** | EASY/MEDIUM/HARD tags should match actual performance after calibration |
| **Bloom / topic heatmaps** | `topic` and `bloomLevel` tags power per-unit and cognitive-level views |

---

*Last updated for SECSA field schema: `difficulty`, `bloomLevel`, `optionA–D`, `correctOption`. See `frontend/src/lib/bloomLevel.ts` for allowed Bloom values per difficulty.*
