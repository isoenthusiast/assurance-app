# Gamification Layer - SEAM Assurance App

## Overview

This gamification layer maps to the **8 Emotional Drives** framework and **Measure Everything** principle from Arthur Carmazi's Game On. It creates sustained engagement in control testing and FLA planning through:

1. **Multiple achievement paths** (so not just top performers get wins)
2. **Daily behavioral measurement** (emotional validation every day)
3. **Clear emotional drive activation** (know which drives are being triggered)
4. **Meaningful milestones** (every 2-3 days of activity)
5. **No-blame measurement** (failure is data, not punishment)

---

## 8 Emotional Drives

### 1. **Diversity & Change** 🎨
Drive for new experiences, anticipation, novelty.

**Activation Mechanics:**
- Test controls from different Process Areas
- Vary work across different control types
- Different times of day activities
- Theme-based monthly challenges

**Badges:**
- Explorer (test from 5 different Process Areas)
- Week of Change (7 different daily patterns)

### 2. **Love & Belonging** 👥
Drive to be with people, feeling cared for and caring.

**Activation Mechanics:**
- Team FLA planning sessions
- Peer feedback and collaboration
- Group achievement targets
- Mentoring and knowledge sharing

**Badges:**
- Team Player (3 team FLA sessions)
- Community Champion (help 5 teammates)

### 3. **Recognition & Significance** 👁️
Drive to feel valuable, to be recognized by others.

**Activation Mechanics:**
- Leaderboards with multiple achievement tracks
- Public badges and achievements
- Quality-based recognition (not just quantity)
- Personal progress highlighting

**Badges:**
- First Test (complete first control test)
- Recognized Expert (1000 points for quality)

### 4. **Achievement** ✅
Drive to complete things and make progress.

**Activation Mechanics:**
- Completion of controls and FLAs
- Milestone tracking (every 2-3 days)
- Progress bars and completion percentages
- Quick wins (5-10 minute tasks)

**Badges:**
- Starter (plan first FLA)
- Milestone Getter (5 milestones)
- Perfect Week (7 day streak)

### 5. **Excellence** 💎
Drive to do more than expected, higher standards.

**Activation Mechanics:**
- Quality scoring for evidence documentation
- Evidence completeness tracking
- Consistency bonuses
- "Going above and beyond" recognition

**Badges:**
- Quality Obsessed (10 controls with >90% quality)
- Perfect Assessor (100% pass rate assessment)

### 6. **Challenging Growth** 📈
Drive to improve oneself, stretch ability.

**Activation Mechanics:**
- Progressive difficulty (easier → harder controls)
- New control types as you progress
- Skill trees (Procedural → Analytical → Complex)
- Learning objectives with evidence

**Badges:**
- Learner (test from 3 sub-processes)
- Rising Star (20% quality improvement month-over-month)

### 7. **Contribution & Responsibility** 🤝
Drive for sense of purpose beyond self.

**Activation Mechanics:**
- Document guides for team reuse
- Identify systemic improvements
- Mentoring activities
- Community knowledge base contributions

**Badges:**
- Mentor (5 documented guides)
- Organization Builder (3 improvement identifications)

### 8. **Security & Control** 🛡️
Drive to feel safe, secure, in control.

**Activation Mechanics:**
- Emphasis on HSSE-critical controls
- Compliance checklists
- Documented procedures
- Risk mitigation focus

**Badges:**
- Safety First (all HSSE-critical controls tested)
- Compliance Champion (0 deficiencies in 3 assessments)

---

## Point System

### Action-Based Points
- **FLA Planned**: 50 points (+25 team bonus)
- **Control Tested**: 100 points
- **HSSE-Critical Control**: +50 bonus
- **Evidence Documented**: 30 points
- **Quality Evidence (>80%)**: 50 points
- **Assessment Completed**: 200 points

### Multipliers
- **Perfect Evidence Quality (>90%)**: 1.5x
- **Daily Streak Bonus**: 1.25x
- **Team Collaboration**: 1.5x

### Weekly Bonus
- 5+ activities in a week: 25 bonus points
- 7 consecutive days active: 50 bonus points

---

## Badge Rarity System

| Rarity | Typical Criteria | Point Value | Frequency |
|--------|-----------------|-------------|-----------|
| **Common** | First action (first test, first FLA) | 25 pts | Very frequent |
| **Uncommon** | Repeated action (5 controls, 3 sub-processes) | 50 pts | Frequent |
| **Rare** | Consistency or team work (7 day streak, team champion) | 100 pts | Moderate |
| **Epic** | Excellence or mastery (100% quality, systemic improvement) | 150 pts | Uncommon |
| **Legendary** | Exceptional achievement (0 deficiencies, perfect assessment) | 250 pts | Rare |

---

## Daily Behavior Measurement

Tracked metrics (daily):
- **Plans Made**: Number of FLAs planned
- **Controls Tested**: Number of controls assessed
- **Evidence Documented**: Quality of documentation
- **Team Engagement**: Participation in collaborative activities
- **Quality Score**: 0-100 based on evidence completeness

**Why Daily Measurement?**
- Provides daily emotional gratification
- Prevents only results being measured
- Identifies trending behaviors early
- Creates multiple "small wins" toward bigger goals

---

## Emotional Drive Metrics

Calculated **weekly/monthly**:
- 8 individual drive scores (0-100 each)
- Overall engagement percentage
- Drive balance analysis
- Trend tracking

**Purpose:**
- Shows which drives are being activated
- Identifies under-activated drives (signal to change mechanics)
- Helps teams understand what motivates them
- Data for "failing intelligently" feedback

---

## Milestone System

**Types:**
- Controls Tested (milestones every 5/10/20)
- Points Earned (milestones every 250/500/1000)
- Days Active (7/30/60 day streaks)
- Assessments Completed (3/5/10)

**Frequency Target:** Milestones reached every 2-3 days to maintain motivation

**Mechanism:**
- Visual progress bars
- Milestone celebrations (emoji, notification)
- Auto-check for badge eligibility

---

## Leaderboard Design

**Problem Solved:** "Only top 3 stay motivated; everyone else gives up"

**Solution:** Multiple comparison modes:

1. **Global Ranking** (all assessors)
2. **Personal Progress** (vs. own starting point)
3. **Drive-Specific Ranking** (excellence leader, growth champion, etc.)
4. **Team Ranking** (process area teams)
5. **Weekly Snapshot** (fresh start each week)

**Feature:** Users can toggle between "comparing to best" vs. "comparing to myself"

---

## Fear Tolerance & Confidence Influencer

**Framework Application:**
- HSSE-critical controls are "secure zone" (low fear tolerance OK)
- FLA planning is "improvement zone" (higher risk tolerance needed)
- Distinction prevents "need-sucking" (security drive killing innovation drive)

**Confidence Influencer Tracking:**
- System identifies lowest fear-tolerance person per team
- Accommodation built in (not forced to high-risk activities)
- Gap between high and low FT determines compromise needed

---

## No-Blame Zone Mechanics

**Measurement Approach:**
- Failed control tests → "Learning opportunity" not "failure"
- Low quality evidence → "Data for improvement" 
- Missed milestones → "Progress snapshot" for coaching

**Gamification Elements:**
- Show trend over time (improvement matters more than absolute)
- Multiple paths to success (quality ≠ quantity)
- "Failing intelligently" recognition (documented improvement attempts)

---

## Implementation Steps

### 1. Database Migration
```bash
npm run prisma:migrate -- --name add_gamification
npm run db:seed:gamification
```

### 2. Seed Badges & Achievements
```bash
tsx prisma/gamification-seed.ts
```

### 3. Add Gamification to Control Testing
When a control test is completed:
```typescript
import { awardPoints } from '@/lib/gamification';

await awardPoints(
  userId,
  100,  // base points
  'control_tested',
  'Achievement',
  assessmentId,
  sampleId,
  qualityScoreMultiplier
);
```

### 4. Add Dashboard
In the main page or assessment detail:
```typescript
import { GamificationDashboard } from '@/components/GamificationDashboard';

<GamificationDashboard userId={currentUserId} />
```

---

## Configuration & Customization

All point values, badge criteria, and emotional drive mappings can be adjusted in:
- `src/lib/gamification.ts` - Point rules and badge definitions
- `BADGE_DEFINITIONS` - Badge descriptions and criteria

---

## API Endpoints

### Award Points/Behavior
```
POST /api/gamification/award
{
  "userId": "...",
  "action": "control_tested|fla_planned|evidence_documented",
  "controlId": "...",
  "assessmentId": "...",
  "isHSSECritical": true,
  "qualityScore": 85,
  "sampleId": "..."
}
```

### Get User Stats
```
GET /api/gamification/stats/:userId
```

### Get Leaderboard
```
GET /api/gamification/leaderboard?limit=10&userId=:userId
```

---

## Monitoring & Tuning

**KPIs to Watch:**
- % of users earning points daily (target: 60%+)
- Average points per assessor (should increase over time)
- Badge completion rate (target: 1 badge per 5 tests)
- Emotional drive balance (goal: all drives 40%+ activated)
- Leaderboard engagement (% checking their rank weekly)

**Adjustment Signals:**
- Drive score < 30%: Adjust badge/point allocation for that drive
- Only 2-3 users on leaderboard winning: Add tier-specific leaderboards
- No milestones reached in 2 weeks: Decrease milestone targets
- Low point variance: Too many same-scoring controls (adjust by HSSE/difficulty)

---

## Future Enhancements

1. **Seasonal Challenges** - Monthly themes activating specific drives
2. **Team Leaderboards** - Process area / shift competitions
3. **Skill Trees** - Progressive unlocking of harder control types
4. **Collaborative Achievements** - Badges requiring team coordination
5. **Coaching Insights** - "Failing intelligently" recommendation engine
6. **Integration with Control Results** - Bonus points for preventive findings

---

## References

- **Framework:** Arthur Carmazi - Game On (8 Emotional Drives, 8 Gamification Elements)
- **Core Principle:** Measure Everything (behaviors, not just results)
- **Cultural:** No-Blame Zone + Failing Intelligently methodology
