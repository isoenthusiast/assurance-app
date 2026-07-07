# SEAM Assurance App - Complete Design & Architecture Documentation

**Last Updated:** July 7, 2026 (v2.0.0) 
**Status:** Production - Deployed on Railway (PostgreSQL) 
**Code Name:** CONAN PROJECT

> **v2.0.0 - PostgreSQL Migration:** Migrated from SQLite to PostgreSQL. Deployed on Railway with Railway PostgreSQL plugin. Pre-deploy schema sync via direct SQL. Activity logging system added with ActivityLogType catalog (31 event types). 24 Prisma models, 10 enums, 60+ API routes.

---

## 1. Executive Summary

The **SEAM Assurance App** (CONAN PROJECT) is a gamified internal control testing platform for oil & gas operations. It enables:

- **Manage Controls:** Create and maintain 28-field control definitions with CSF framework alignment
- **Plan Assessments:** Build assessments from reusable templates with cascading filters
- **Execute Tests:** Record samples, findings, and corrective actions per control
- **Track Engagement:** Gamification via 8 emotional drives, badges, milestones, points
- **Activity Logging:** Full audit trail of all user actions (31 event types)

**Core Design Principle:** Decouple controls from samples - assessments have independent relationships to both.

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|--------|
| **Framework** | Next.js | 16.2.9 | App Router |
| **Database** | PostgreSQL | 16/18 | Relational DB |
| **ORM** | Prisma | 7.8.0 | Type-safe access |
| **Auth** | NextAuth.js | 5.x beta | JWT auth |
| **Deployment** | Railway | - | Docker + PG plugin |
