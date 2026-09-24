---
description: Trae main (Lovable) a deployment corrigiendo las regresiones a Supabase
argument-hint: "[fecha o etiqueta del merge]  (por defecto: hoy)"
allowed-tools: Bash(git:*), Bash(grep:*), Bash(npm run:*), Read, Glob, Grep, Edit, Write, Skill
---

Ejecuta el merge `main → deployment` siguiendo el skill `merge-lovable`.

1. Verifica que el árbol esté limpio y que estemos en `deployment` actualizada.
2. Crea `merge/lovable-$1` (o con la fecha de hoy si no doy argumento) y haz `git merge main`.
3. Resuelve conflictos con la regla: **UI de `main`, capa de datos de `deployment`**.
4. Corre la verificación anti-regresión y muéstrame solo el resultado:
   - `grep -rn "supabase\." src --include=*.ts --include=*.tsx` → debe salir vacío
   - `grep -rn "fetch(" src/components src/routes --include=*.tsx`
   - `npm run lint && npm run build`
5. Lístame los componentes que hubo que corregir y qué patrón se aplicó en cada uno.
6. Si el merge trae UI que necesita un endpoint inexistente, **no lo inventes**: dímelo para
   abrirlo primero en `SPEC.md` y en el backend.

No hagas push ni abras PR sin confirmármelo.
