# Gamification Integration Guide

## Quick Start - 5 Steps to Enable Gamification

### Step 1: Update Prisma Schema
Already done! The schema includes:
- `User` extended with gamification fields
- 6 new models: `AchievementBadge`, `UserAchievement`, `PointTransaction`, `BehaviorMeasurement`, `EmotionalDriveMetric`, `Milestone`

### Step 2: Run Database Migration
```bash
cd seam-assurance-app
npm run prisma migrate dev --name add_gamification
```

### Step 3: Seed Badges
```bash
tsx prisma/gamification-seed.ts
```

### Step 4: Integrate into Sample (Control Test) Page

In `src/app/fla/[id]/SampleRow.tsx`, when a test is marked as complete:

```typescript
import { awardPoints, POINT_RULES } from '@/lib/gamification';

// When sample status changes to "Tested"
const handleTestComplete = async (sampleId: string, controlId: string, conclusion: 'Pass' | 'Fail', evidenceQuality: number) => {
  // Update sample in database
  await updateSample(...);

  // Award gamification points
  const control = await getControl(controlId); // Get control details
  
  await awardPoints(
    userId,
    POINT_RULES.CONTROL_TESTED,
    'control_tested',
    'Achievement',
    assessmentId,
    sampleId,
    control.isHsseCritical ? 1.5 : 1.0
  );

  // If evidence quality is high, award bonus
  if (evidenceQuality > 80) {
    await awardPoints(
      userId,
      30,
      'evidence_quality',
      'Excellence',
      assessmentId,
      sampleId,
      1.0
    );
  }
};
```

### Step 5: Add Gamification Dashboard

In the main FLA page (`src/app/fla/page.tsx`):

```typescript
import { GamificationDashboard } from '@/components/GamificationDashboard';
import { getSession } from '@/auth';

export default async function FlaDashboardPage() {
  const session = await getSession();
  const userId = session?.user?.id;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Existing FLA list */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          {/* FLA assessments list */}
        </div>
        
        {/* Gamification sidebar */}
        <div>
          {userId && <GamificationDashboard userId={userId} />}
        </div>
      </div>
    </div>
  );
}
```

---

## Integration Points

### When FLA is Planned
```typescript
// In src/app/fla/new/page.tsx or actions
const handlePlanFLA = async (data: AssessmentData) => {
  const assessment = await createAssessment(data);
  
  // Award points
  const pointValue = data.teamPlanning 
    ? POINT_RULES.FLA_PLANNED_TEAM 
    : POINT_RULES.FLA_PLANNED;
    
  await awardPoints(
    userId,
    pointValue,
    'fla_planned',
    'Achievement',
    assessment.id
  );
  
  // Check for "Starter" badge
  const assessmentCount = await getAssessmentCount(userId);
  if (assessmentCount === 1) {
    await awardBadge(userId, 'Starter');
  }
};
```

### When Evidence is Documented
```typescript
// In sample detail component
const handleEvidenceUpload = async (sampleId: string, evidenceFile: File, qualityScore: number) => {
  const result = await uploadEvidence(sampleId, evidenceFile);
  
  // Award points based on quality
  const basePoints = POINT_RULES.EVIDENCE_DOCUMENTED;
  const multiplier = qualityScore > 80 ? 1.5 : 1.0;
  
  await awardPoints(
    userId,
    basePoints,
    'evidence_documented',
    qualityScore > 80 ? 'Excellence' : 'Contribution',
    assessmentId,
    sampleId,
    multiplier
  );
  
  // Update daily behavior
  await recordDailyBehavior(userId, new Date(), {
    evidenceDocumented: 1,
    qualityScore
  });
};
```

### When Assessment is Completed
```typescript
// In assessment completion handler
const handleCompleteAssessment = async (assessmentId: string) => {
  const assessment = await updateAssessmentStatus(assessmentId, 'Completed');
  
  // Award milestone points
  await awardPoints(
    userId,
    POINT_RULES.ASSESSMENT_COMPLETED,
    'assessment_completed',
    'Achievement',
    assessmentId
  );
  
  // Check for badges
  const samples = await getSamples(assessmentId);
  const allPass = samples.every(s => s.conclusion === 'Pass');
  
  if (allPass) {
    await awardBadge(userId, 'Perfect Assessor');
  }
  
  // Update milestones
  await trackMilestone(userId, 'assessments_completed', 'Complete Assessments', 3);
};
```

---

## Component Integration Examples

### Adding Points Display to FLA List Item
```typescript
// In SampleRow.tsx or assessment summary
<div className="flex items-center gap-4">
  <div className="flex-1">
    {/* Existing control info */}
  </div>
  
  {/* New: Gamification info */}
  <div className="text-right">
    <p className="text-sm font-medium text-slate-900">
      {sampleStatus === 'Tested' && '+100 pts 🏆'}
    </p>
    <p className="text-xs text-slate-500">
      {qualityScore > 80 && 'Quality: Excellent! +50 bonus'}
    </p>
  </div>
</div>
```

### Mini Dashboard in FLA Detail Page
```typescript
// In src/app/fla/[id]/page.tsx
import { GamificationDashboard } from '@/components/GamificationDashboard';

<div className="grid grid-cols-3 gap-6">
  <div className="col-span-2">
    {/* Existing assessment detail */}
  </div>
  
  <aside className="space-y-4">
    <div className="rounded border bg-white p-4">
      <h3 className="font-semibold mb-2">This FLA Session</h3>
      <div className="text-sm text-slate-600">
        <p>Controls tested: {testedCount}/{totalCount}</p>
        <p>Points earned: {sessionPoints}</p>
        <p>Badges earned: {sessionBadges.length}</p>
      </div>
    </div>
    
    {/* Full dashboard */}
    <GamificationDashboard userId={userId} />
  </aside>
</div>
```

---

## Testing Gamification

### Manual Testing Checklist
- [ ] Create user account
- [ ] Plan FLA → should see +50 points
- [ ] Test control with high quality evidence → should see +100 + bonus
- [ ] Check gamification dashboard → should show updated points/behaviors
- [ ] Complete 7 controls → should earn "Learner" badge
- [ ] Maintain 7-day activity streak → should earn "Perfect Week" badge
- [ ] Check leaderboard → user should appear in ranking

### Seeding Test Data
```bash
# Run seed to create test badges
tsx prisma/gamification-seed.ts

# Create test user with points
tsx prisma/seed-test-gamification.ts  # (create this file for testing)
```

---

## Customization Points

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
Edit `BADGE_DEFINITIONS` in same file:
```typescript
{
  name: "Custom Badge Name",
  description: "Description of achievement",
  emotionalDrive: "Growth" as EmotionalDrive,
  rarity: "Rare" as BadgeRarity,
  controlsChecked: 20,
  achievementType: "custom_type",
}
```

### Adjust Emotional Drive Scoring
Edit `DRIVE_SCORING` object:
```typescript
Diversity: {
  DIFFERENT_PROCESS: 20,  // Increased from 15
  DIFFERENT_CONTROL_TYPE: 15,  // Increased from 10
}
```

---

## Performance Considerations

### Database Indexes
Already included in schema:
- `PointTransaction`: `userId`, `createdAt`
- `BehaviorMeasurement`: `userId`, `date`
- `EmotionalDriveMetric`: `userId`
- `AchievementBadge`: `emotionalDrive`

### Optimization Tips
1. **Lazy load dashboard** - Only fetch when viewed
2. **Cache leaderboard** - Update every 5 minutes instead of per request
3. **Batch point awards** - Group multiple actions, award once per session
4. **Archive old transactions** - Keep 6 months active, archive older

---

## Monitoring & Debugging

### Check Point Transactions
```sql
SELECT user_id, SUM(points) as total_points, COUNT(*) as transaction_count
FROM "PointTransaction"
GROUP BY user_id
ORDER BY total_points DESC;
```

### View User Achievements
```sql
SELECT ua.user_id, ab.name, ab.emotional_drive, ua.earned_at
FROM "UserAchievement" ua
JOIN "AchievementBadge" ab ON ua.badge_id = ab.id
WHERE ua.user_id = 'USER_ID'
ORDER BY ua.earned_at DESC;
```

### Check Behavior Trends
```sql
SELECT date, COUNT(*) as active_users, AVG(quality_score) as avg_quality
FROM "BehaviorMeasurement"
GROUP BY date
ORDER BY date DESC;
```

---

## Common Issues & Solutions

### User has points but no badges
- Badges are earned on action completion, not accumulated
- Check `UserAchievement` table for actual badge records
- May need to run badge award logic manually

### Leaderboard not updating
- Ensure `totalPoints` on User is being updated after each transaction
- Check if there's a cache layer preventing updates
- Verify API endpoint is fetching latest data

### Emotional drives all at 0
- Need to call `updateEmotionalDriveMetrics()` after behavior updates
- Consider adding scheduled job to calculate weekly
- Check if correct emotional drives are being passed to `awardPoints()`

---

## Next Steps

1. **Run migration** to add gamification schema
2. **Seed badges** with predefined achievements
3. **Integrate point-awarding** into FLA/control testing flows
4. **Add dashboard** to main pages
5. **Monitor KPIs** and adjust point values/badges based on usage
6. **Gather feedback** from assessors on what motivates them
7. **Iterate** - gamification is a tuning exercise, not a one-time setup

See `GAMIFICATION.md` for framework details and philosophy.
