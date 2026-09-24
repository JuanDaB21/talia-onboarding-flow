---
description: Sincroniza este repo y el del backend con sus remotos y reporta qué cambió
allowed-tools: Bash(git fetch:*), Bash(git pull --ff-only), Bash(git status:*), Bash(git log:*), Bash(git branch:*)
---

Sincroniza los dos repos y reporta en 5 líneas.

1. Aquí (`talia-onboarding-flow`, rama `deployment`): `git fetch origin --prune` + `git pull --ff-only`.
   Reporta también si `origin/main` (Lovable) trae commits nuevos sin mergear — eso significa que
   toca `/merge-lovable`, pero **no lo hagas ahora**.
2. Backend (`C:\Users\jefte\OneDrive\Documentos\TALIA\talia`, rama `main`): lo mismo.
3. Reporta por repo: rama, commits nuevos traídos (`hash asunto`, uno por línea), árbol limpio o no.
4. Si alguno tiene cambios sin commitear o no está en la rama esperada, dilo y **no** hagas pull
   ahí: pregúntame.
5. Si el backend trajo migraciones nuevas en `backend/db/migrations/`, nómbralas: puede que el
   front dependa de ellas y falte correrlas en prod.

Nunca uses `git pull` con merge ni rebase automático: solo `--ff-only`.
