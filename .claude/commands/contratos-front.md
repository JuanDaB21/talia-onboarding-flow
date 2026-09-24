---
description: Audita el diff del front (o un PR) contra los contratos y dice si es APTO para PR
argument-hint: "[número de PR | rama base]  (por defecto: deployment...HEAD)"
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(grep:*), Bash(npm run:*), Read, Glob, Grep, Skill, Agent
---

Audita los cambios del front.

Ámbito: $1 — si viene un número, `gh pr diff $1`; si viene una rama, `git diff $1...HEAD`;
si no viene nada, `git diff deployment...HEAD`.

Sigue el skill `revision-front`. Delega la lectura del diff al subagente `revisor-front` para no
cargarlo en esta conversación, y muéstrame solo su reporte: hallazgos con `archivo:línea` y
veredicto **APTO / NO APTO**.

Bloqueantes que van primero si aparecen:
- cualquier `supabase.` reintroducido en la capa de datos;
- `fetch` o `api.*` directo dentro de un componente (T5);
- endpoint usado que no está en el `SPEC.md` del backend (T1).
