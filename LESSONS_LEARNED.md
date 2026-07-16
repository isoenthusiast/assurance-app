# Deployment Lessons Learned — CONAN PROJECT

## 1. `prisma db push` P2002 Error

**Symptom:** `Error: P2002 — Unique constraint failed on the fields: (id)`

**Root Cause:** Prisma 7.x `db push` conflicts with the `_prisma_migrations` tracking table on Railway PostgreSQL.

**Fix:** Never use `prisma db push`. Instead, apply schema changes via direct SQL:
```bash
# Write SQL in scripts/sync-schema.sql with IF NOT EXISTS guards
# Run via Python/psycopg2:
python scripts/sync_schema.py
# Then regenerate Prisma client:
node node_modules/prisma/build/index.js generate
```

**Prevention:** All schema changes go through `scripts/sync_schema.py` → `prisma generate`. The `prisma db push` task is deprecated.

---

## 2. TypeScript Build: Model Field Name ≠ Prisma Field Name

**Symptom:** `Property 'name' does not exist on type '{ attributeName: string; ... }'`

**Root Cause:** The Prisma model field is `attributeName` but code referenced `.name`. Prisma includes return the actual database column names, not aliases.

**Fix:** Always use the exact Prisma schema field name. Check `schema.prisma` if unsure.

**Prevention:** After adding a new model, do a case-sensitive search for all references to its fields. Use the exact camelCase names from the schema.

---

## 3. TypeScript Build: `string | null` ≠ `string | undefined`

**Symptom:** `Type 'string | null' is not assignable to type 'string | undefined'`

**Root Cause:** `logActivity()` returns `string | null` (database can return null), but `awardPoints(activityLogId?: string)` only accepts `string | undefined`.

**Fix:** Change the parameter type to `activityLogId?: string | null` so both null and undefined are accepted. Prisma nullable fields accept both.

**Prevention:** When a function returns a nullable value and it's passed to another function, always check the receiving parameter type. Prefer `string | null` for Prisma nullable fields.

---

## 4. TypeScript Build: Missing Reverse Relation

**Symptom:** `Error P1012 — The relation field 'activityLog' on model 'PointTransaction' is missing an opposite relation`

**Root Cause:** Prisma requires bidirectional relations. Adding `activityLog ActivityLog?` on PointTransaction requires `pointTransactions PointTransaction[]` on ActivityLog.

**Fix:** Always add the reverse relation field when creating a new FK. Run `prisma format` to auto-detect missing relations.

**Prevention:** After adding any `@relation` field, immediately add the corresponding array/list field on the target model.

---

## 5. Runtime: `Cannot read properties of undefined (reading 'actions')`

**Symptom:** Runtime crash when accessing `f._count.actions` on findings.

**Root Cause:** The API `include` didn't include `_count`, but the client code tried to access it. Prisma only returns relations you explicitly `include`/`select`.

**Fix:** Use optional chaining with safe fallback: `f.actions?.length || 0` instead of `f._count.actions`. Or add `_count: { select: { actions: true } }` to the query.

**Prevention:** Every `include` in a Prisma query must match exactly what the client component expects. When adding a new field to a client type, verify the API query includes it.

---

## 6. TypeScript Build: Prisma Date ≠ String

**Symptom:** `Type 'Date | null' is not assignable to type 'string | null'`

**Root Cause:** Prisma returns `DateTime` fields as JavaScript `Date` objects in the API response, but the client type declared them as `string`.

**Fix:** Use `Date | string | null` in client-side types. When rendering, wrap in `new Date()` which handles both.

**Prevention:** Client-side types for API responses should use `Date | string` for date fields. Prisma serializes Dates as ISO strings over the wire, but the server-side type is `Date`.

---

## 7. Removing a Model: Full Impact Analysis Required

**Symptom:** After removing `BehaviorMeasurement` model, the app crashed because `BehaviorTrends` component still referenced it.

**Root Cause:** Model removal is not just schema + database. It cascades to: gamification lib, API routes, UI components, export scripts, schema introspection, fallback schemas, and seed scripts.

**Fix:** Use `grep`/agent search for ALL references before deleting. Removed from 20+ files across schema, lib, API, UI, scripts, and docs.

**Prevention:** Before removing a model, run a full workspace search for the model name. Check: `schema.prisma`, `src/lib/`, `src/app/api/`, `src/components/`, `src/app/`, `prisma/`, `scripts/`, `*.json`, `*.md`.

---

## 8. Deployment Pipeline: Build First Locally

**Symptom:** 4 consecutive Railway build failures before success.

**Root Cause:** Railway runs `npx prisma generate && npm run build` which includes full TypeScript type-checking. Errors that Turbopack ignores in dev mode will fail the Railway build.

**Fix:** Run `npm run build` locally before pushing to catch TS errors. The dev server (Turbopack) is lenient; the production build is strict.

**Prevention:** Add a pre-push check habit: make changes → `prisma generate` → `npm run build` → fix errors → commit & push.

---

## Summary Checklist for Schema Changes

- [ ] Add model/field to `schema.prisma`
- [ ] Add reverse relation on target model
- [ ] Run `prisma generate` locally
- [ ] Write SQL migration in scripts/ with `IF NOT EXISTS`
- [ ] Run Python migration script against Railway DB
- [ ] Update all API queries that `include` the changed model
- [ ] Update all client-side types to match Prisma return types
- [ ] Search for all code references to changed model
- [ ] Run `npm run build` locally and fix all TS errors
- [ ] Commit with descriptive message: `feat(scope): what changed`
- [ ] Push → Railway auto-deploys

---

## 9. Turbopack: Bare `catch {}` Causes Parse Error

**Symptom:** `Expected a semicolon` at outer `} catch (error) {` line, with parsing ecmascript source code failed.

**Root Cause:** Turbopack (Next.js 16.2.9) does not support optional catch binding (`catch { }` without a variable). The parser gets confused by the bare `catch` and misinterprets subsequent brace blocks.

**Fix:** Always use `catch (_e) { }` or `catch (e: any) { }` — never bare `catch { }`.

**Prevention:** When writing try/catch blocks, always include an error variable even if unused. Prefer `_e` convention for intentionally unused catch variables.

---

## 10. Turbopack: Stale Cache After File Edits

**Symptom:** Parse errors reference variable names and line numbers that don't exist in the current file (e.g., `knowingBoxId`). The error persists across multiple edits and restarts.

**Root Cause:** Turbopack caches compiled modules aggressively. When a file has a parse error, subsequent correct edits may not invalidate the cache. The error output references stale compiled code.

**Fix:** Kill the dev server, delete `.next` folder, restart. For stubborn cases: `taskkill /PID <pid> /F` then `Remove-Item -Recurse .next` then restart dev server.

**Prevention:** If a parse error makes no sense relative to the current file contents, clear the cache before debugging the code further.

---

## 11. Railway Build: Missing `import { cookies }` 

**Symptom:** Railway `next build` fails with `Type error: Cannot find name 'cookies'` at line using `await cookies()`.

**Root Cause:** Turbopack dev mode auto-imports `cookies` from `next/headers` implicitly, but the production `next build` TypeScript check requires explicit import.

**Fix:** Always add `import { cookies } from "next/headers"` in any route handler that uses `cookies()`.

**Prevention:** Run `npm run build` locally before pushing to catch strict TypeScript errors that Turbopack dev mode ignores.

---

## 12. Prisma 7.8: Model Delegate Not Available at Runtime

**Symptom:** `PrismaClientValidationError` when calling `prisma.knowledgebase.findMany()`. The generated TypeScript types include the model, but the runtime delegate is missing.

**Root Cause:** Prisma 7.8 has a bug where certain models (Knowledgebase) are generated as TypeScript types but not included in the runtime Prisma Client delegate class.

**Fix:** Use `prisma.$queryRawUnsafe()` for all queries on affected models. For the data API generic table route, add the table to a `RAW_SQL_TABLES` set that forces the raw SQL path.

**Prevention:** After regenerating Prisma client, verify the model exists in `src/generated/prisma/internal/class.ts`. If not, add it to `RAW_SQL_TABLES` in the generic data route and use `$queryRawUnsafe` in server components.

---

## 13. State Variable Cleanup: Check All References

**Symptom:** `ReferenceError: cfProcessAreas is not defined` after removing state variables that seemed unused.

**Root Cause:** `cfProcessAreas` and `cfSubProcesses` were used by both the removed `ControlForm` component AND the "Bulk Map Controls to Requirements" section. Removing the state broke the bulk map feature.

**Fix:** Before removing any state variable, search for ALL references including JSX template expressions that may not be obvious.

**Prevention:** Use "Find All References" or grep for the variable name before deletion. State variables shared across multiple UI sections must be preserved even if one consumer is removed.

---

## 14. `@@unique` Constraint Change Requires Full Migration

**Symptom:** Changing `@@unique([requirementId, standard, companyId])` to `@@unique([requirementId, processAreaId, companyId])` — the old index prevented creating per-PA Unmapped Controls.

**Root Cause:** The unique constraint design dictated the data model. One Unmapped Controls per standard meant 6 requirements serving 65 PAs. The constraint had to be changed to support the correct design.

**Fix:** Coordinated 4-step migration: (1) Drop old unique index, (2) Create new unique index, (3) Create missing Unmapped Controls per PA (177 created), (4) Remap 3,186 controls via ControlSubProcess → SubProcess → ProcessArea chain.

**Prevention:** When designing unique constraints, consider the actual domain requirements (one per PA vs one per standard). Test the constraint against real usage scenarios before committing to it.

---

## 15. PowerShell Inline Python Is Always Broken

**Symptom:** `python -c "..."` commands fail with parse errors, missing parentheses, or "The 'from' keyword is not supported".

**Root Cause:** PowerShell's command parser conflicts with Python syntax — semicolons, quotes, and parentheses are interpreted differently.

**Fix:** Always write Python scripts to `.py` files and run them. Never attempt inline Python in PowerShell.

**Prevention:** This is Lesson #22 from previous sessions, re-confirmed today. The `create_and_run_task` with a `.py` file is the reliable pattern.
