# Pre-Deployment Checklist

Run through this BEFORE every `git push` that changes the data model or API routes.

---

## 1. Schema Change Audit
- [ ] `schema.prisma` changes reflected in `prisma/sync-schema.ts`?
  - New columns → `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  - New tables → `CREATE TABLE IF NOT EXISTS` with matching columns
  - Changed `@unique` → `@@unique([...])` → update all `ON CONFLICT` clauses
  - New constraints → `CREATE UNIQUE INDEX IF NOT EXISTS`
- [ ] All 10 adopt-template tables have business-key unique constraints?
  - Standard: `@@unique([standard, companyId])`
  - ProcessArea: `@@unique([name, companyId])`
  - SubProcess: _(junction — covered by ControlSubProcess unique)_
  - Requirement: `@@unique([requirementId, standard, companyId])`
  - Control: `@@unique([name, companyId])`
  - AssessmentTemplate: `@@unique([name, companyId])`
  - ControlSubProcess: `@@unique([controlId, subProcessId])`
  - MapControl2Requirement: `@@unique([controlId, requirementRId])`
  - AssessmentTemplateControlLinkage: _(has implicit unique)_
  - AssessmentTemplateActivityType: _(has implicit unique)_
- [ ] Raw SQL INSERTs set all NOT NULL columns without defaults?
  - Check: `@updatedAt` columns → must set `NOW()` explicitly
  - Check: `@default(now())` columns → safe (DB default exists)

## 2. No Destructive Backfills
- [ ] `sync-schema.ts` contains NO INSERT/UPDATE/DELETE backfills?
  - Only `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
  - One-time data operations belong in standalone scripts, NOT deploy hooks
  - Removed: MapControl2Requirement Cartesian backfill, Standard NULL-companyId backfill

## 3. Shared Import Audit
- [ ] New shared utilities (`src/lib/*.ts`) imported in ALL consumers?
  - Run: `grep_search` for function name across `**/*.tsx` and `**/*.ts`
  - Cross-reference with `grep_search` for `import.*from`
  - Railway build runs full TypeScript — missing imports are deploy failures

## 4. Route Compilation Check
- [ ] All modified API routes return 200 (not 404)?
  - If 404: touch the route file, save a minimal version, verify it works, restore full code
  - Stale Turbopack compilation is the #1 cause of phantom 404s

## 5. Pre-Push Verification ⚠️ CRITICAL — skip this and deploy WILL fail
- [ ] **`npx next build` succeeds locally?** — Railway runs full TypeScript checking; Turbopack dev mode skips many type errors
  - Common failures: type mismatches in `.reduce()`, missing imports, wrong generic params
  - If build fails: fix ALL type errors before pushing. The dev server showing no errors is NOT sufficient
- [ ] `git diff --stat` reviewed → commit message describes actual changes?
  - Never use generic messages like "chore: sync" or "chore: trigger deploy"
- [ ] All changed files explicitly staged and committed? _(no lingering uncommitted changes)_
- [ ] Prisma client regenerated if `schema.prisma` changed? (`npx prisma generate`)

## 6. Post-Deploy Verification
- [ ] Railway deploy logs show no `P2010` / `42P10` errors?
  - These mean `ON CONFLICT` references a constraint that doesn't exist
- [ ] `ANALYZE` ran? _(refreshes pg_stat_user_tables counts in admin UI)_
- [ ] Adopt Templates works once (not twice)?

## Known Removed Backfills
| Backfill | Why Removed | Date |
|----------|-------------|------|
| MapControl2Requirement Cartesian INSERT | Created 12,003 unwanted rows on every deploy | 2026-07-14 |
| Standard NULL-companyId INSERT | Created orphan rows with companyId=NULL on every deploy | 2026-07-16 |
| backfill_control_requirement.py | Disabled with sys.exit(1) guard | 2026-07-14 |
