# Gamification Setup Guide - Quick Start

Follow these steps to activate gamification in your seam-assurance-app:

## ✅ Step 1: Update Database Schema

The Prisma schema has been updated with gamification models. Create and run the migration:

```bash
cd seam-assurance-app
npm run prisma migrate dev --name add_gamification
```

This creates:
- 6 new database tables
- Extends User model with gamification fields
- Creates indexes for performance

## ✅ Step 2: Seed Achievement Badges

Load all 18 achievement badges into the database:

```bash
tsx prisma/gamification-seed.ts
```

Expected output:
```
🎮 Seeding gamification badges...
  ✓ Created: 🎨 Explorer (Uncommon)
  ✓ Created: 👥 Team Player (Uncommon)
  ...
✅ Gamification seed complete!
   Created: 18
   Total badges: 18
```

## ✅ Step 3: Code Updates (Already Done!)

The following files have been updated with gamification integration:

### Updated Files:
1. **prisma/schema.prisma** - Added gamification models
2. **src/lib/gamification.ts** - Core gamification engine
3. **src/components/GamificationDashboard.tsx** - React dashboard
4. **src/app/fla/actions.ts** - Points awarding in FLA flows
5. **src/app/fla/page.tsx** - Added dashboard sidebar
6. **src/app/fla/[id]/page.tsx** - Show points earned
7. **src/app/api/gamification/** - API endpoints
8. **GAMIFICATION.md** - Full documentation
9. **GAMIFICATION_INTEGRATION.md** - Integration guide

### What's Integrated:
- ✅ FLA Planning awards 50 points + daily behavior tracking
- ✅ Control Testing awards 100-150 points (HSSE bonus)
- ✅ Assessment Completion awards 200 points
- ✅ Daily behavior measurement (plans, tests, evidence)
- ✅ "First Test" and "Starter" badges auto-awarded
- ✅ Milestone tracking (every 2-3 days of activity)
- ✅ Main FLA dashboard shows gamification sidebar
- ✅ Assessment detail shows points earned

## ✅ Step 4: Test It

1. **Start the app:**
   ```bash
   npm run dev
   ```

2. **Create a test user** (if using dev environment)
   - Default admin: username `admin` (check console for password)

3. **Test the flow:**
   - Go to `/fla`
   - Click "Plan Assessment" → Creates FLA, awards 50 points
   - Check sidebar → Should see +50 points
   - Add controls as samples
   - Mark a control as "Tested" → Awards 100+ points
   - See "First Test" badge earned
   - Check leaderboard ranking

4. **Verify data:**
   ```bash
   sqlite3 prisma/dev.db
   SELECT username, total_points FROM User;
   SELECT * FROM UserAchievement;
   SELECT * FROM PointTransaction LIMIT 5;
   ```

## 📊 Monitor Gamification Activity

### Check User Points
```bash
sqlite3 prisma/dev.db
SELECT u.name, u.total_points, COUNT(pt.id) as transactions
FROM User u
LEFT JOIN PointTransaction pt ON u.id = pt.user_id
GROUP BY u.id
ORDER BY u.total_points DESC;
```

### View Recent Transactions
```bash
sqlite3 prisma/dev.db
SELECT u.name, pt.reason, pt.points, pt.emotional_drive, pt.created_at
FROM PointTransaction pt
JOIN User u ON pt.user_id = u.id
ORDER BY pt.created_at DESC
LIMIT 20;
```

### See Awarded Badges
```bash
sqlite3 prisma/dev.db
SELECT u.name, ab.name, ab.emotional_drive, ua.earned_at
FROM UserAchievement ua
JOIN User u ON ua.user_id = u.id
JOIN AchievementBadge ab ON ua.badge_id = ab.id
ORDER BY ua.earned_at DESC;
```

## 🎯 Key Features Active

### Points System
- **FLA Planned:** 50 pts
- **Control Tested:** 100 pts
- **HSSE-Critical Control:** +50 bonus
- **Quality Evidence:** 1.5x multiplier
- **Assessment Completed:** 200 pts

### Badges Tracking
- 8 Emotional Drives covered
- 18 total badges across 5 rarity levels
- Auto-awarded on achievement

### Daily Behavior
- Plans made
- Controls tested
- Evidence documented
- Team engagement
- Quality score

### Emotional Drives
- Diversity 🎨
- Belonging 👥
- Recognition ⭐
- Achievement ✅
- Excellence 💎
- Growth 📈
- Contribution 🤝
- Security 🛡️

### Milestones
- Every 2-3 days of activity
- Auto-tracked for: FLAs, controls, points, streaks

## 🔧 Customization

### Adjust Point Values
Edit `src/lib/gamification.ts`:
```typescript
export const POINT_RULES = {
  FLA_PLANNED: 75,  // Changed from 50
  CONTROL_TESTED: 150,  // Changed from 100
  // ...
};
```

### Add New Badges
Edit `BADGE_DEFINITIONS` in same file and re-seed:
```bash
tsx prisma/gamification-seed.ts
```

### Adjust Drive Scoring
Edit `DRIVE_SCORING` for weighting:
```typescript
Excellence: {
  QUALITY_SCORE_90_PLUS: 30,  // Increased from 25
}
```

## 📱 Dashboard Features

The gamification dashboard shows:
1. **Points Card** - Total + weekly progress
2. **Achievements Card** - Badges + daily streak
3. **Emotional Drives Meter** - 8 drives with visual bars
4. **Milestone Tracker** - Progress toward active milestones
5. **Leaderboard** - Global ranking + personal rank
6. **Behavior Trends** - Weekly activity visualization
7. **Badge Gallery** - Earned achievements showcase

## 🔍 API Endpoints

### Award Points
```
POST /api/gamification/award
{
  "userId": "user123",
  "action": "control_tested",
  "controlId": "ctrl456",
  "assessmentId": "assess789",
  "isHSSECritical": true,
  "qualityScore": 85,
  "sampleId": "sample012"
}
```

### Get Stats
```
GET /api/gamification/stats/:userId
```

### Get Leaderboard
```
GET /api/gamification/leaderboard?limit=10&userId=user123
```

## ❌ Troubleshooting

### Migration Failed
- Check database is writable
- Ensure Prisma is up to date: `npm install @prisma/client@latest`
- Try: `npm run prisma migrate reset` (⚠️ deletes data)

### No Points Showing
- Check migration ran: `sqlite3 prisma/dev.db ".schema PointTransaction"`
- Verify actions are updated
- Check browser console for errors
- Restart dev server: `npm run dev`

### Dashboard Not Loading
- Ensure `GamificationDashboard` is imported
- Check session/auth is working
- Verify API endpoints exist
- Check network tab for 404 errors

### Badges Not Awarding
- Verify badges were seeded: `sqlite3 prisma/dev.db "SELECT COUNT(*) FROM AchievementBadge;"`
- Check badge names match exactly
- Verify criteria are being met
- Check database for UserAchievement records

## 📚 Documentation

For detailed information, see:
- **GAMIFICATION.md** - Complete framework and philosophy
- **GAMIFICATION_INTEGRATION.md** - Implementation details and examples

## 🚀 Next Steps

1. ✅ Follow steps 1-4 above
2. ✅ Test with sample data
3. ⏭️ Monitor KPIs (see GAMIFICATION.md)
4. ⏭️ Gather assessor feedback
5. ⏭️ Adjust point values based on usage

## 🎉 You're Ready!

The gamification layer is integrated and ready to engage your assurance team. Run the migrations, test the flow, and start earning points!
