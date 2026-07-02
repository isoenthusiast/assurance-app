# Load SEAM Controls into Database

This guide will load all 48 SEAM control statements from the Frontline Library into your database with their proper Process Areas and Sub-Processes hierarchy.

## ✅ Prerequisites

- Gamification database migration must be run (`npm run prisma migrate dev`)
- Badge seed completed (`tsx prisma/gamification-seed.ts`)
- Control statements JSON file available

## 📋 Step 1: Copy Control Statements File

The control statements JSON was generated and is located in your outputs folder. You need to copy it to the app:

```bash
# Copy the control statements to the app
cp "C:\Users\edwar\AppData\Roaming\Claude\local-agent-mode-sessions\efb04753-ce07-43ed-962c-4b1f2b3962ad\50f6af84-99b9-4f28-af70-7bbb9d5b4951\local_f260833e-e992-4203-91f0-9203f86348d6\outputs\seam_control_statements.json" "C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app\prisma\seam_control_statements.json"
```

Or manually:
1. Navigate to `C:\Users\edwar\AppData\Roaming\Claude\local-agent-mode-sessions\efb04753-ce07-43ed-962c-4b1f2b3962ad\50f6af84-99b9-4f28-af70-7bbb9d5b4951\local_f260833e-e992-4203-91f0-9203f86348d6\outputs\`
2. Find `seam_control_statements.json`
3. Copy it to `C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app\prisma\`

## 📊 Step 2: Run the Control Seed Script

```bash
cd "C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app"

tsx prisma/seed-controls.ts
```

**Expected output:**
```
🎮 Loading SEAM Controls into Database...

✓ Loaded 48 control statements

📋 Processing: Ensure Safe Production (ESP)
   ✓ Created Process Area: Ensure Safe Production (ESP)
   ├─ ✓ Created Sub-Process: Manage Abnormal Situations
   │  ✓ Created 7 controls
   ├─ ✓ Created Sub-Process: Ensure Plan Delivery
   │  ✓ Created 4 controls
   ├─ ✓ Created Sub-Process: Proactive Monitoring
   │  ✓ Created 4 controls
   ├─ ✓ Created Sub-Process: Manage Limits and Alarms
   │  ✓ Created 8 controls

📋 Processing: Control of Work
   ✓ Created Process Area: Control of Work
   ├─ ✓ Created Sub-Process: Work Hazard Management
   │  ✓ Created 1 controls
   ... [more sub-processes]

📋 Processing: Contractor HSSE Management
   ... [similar structure]

✅ SEAM Controls Loaded Successfully!

Summary:
  • Process Areas: 3 created
  • Sub-Processes: 10 created
  • Controls: 48 created

Total controls in database: 48
```

## 🔍 Step 3: Verify Controls Are Loaded

Check the database:

```bash
# Count controls by process area
sqlite3 prisma/dev.db "SELECT pa.name, COUNT(c.id) as control_count FROM Control c JOIN ProcessArea pa ON c.process_area_id = pa.id GROUP BY pa.id;"
```

**Expected output:**
```
Control of Work|7
Contractor HSSE Management|6
Ensure Safe Production (ESP)|16
```

Or verify all controls were created:

```bash
sqlite3 prisma/dev.db "SELECT COUNT(*) as total_controls FROM Control;"
```

**Expected output:**
```
48
```

## ✅ Step 4: Test in the App

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Go to `/setup/controls`** - You should see all 48 controls listed!

3. **Filter by process area:**
   - Click on different controls to see their process area and sub-process assignments

4. **Create an FLA with these controls:**
   - Go to `/fla` and click "+ Plan Assessment"
   - Add controls as samples
   - Test some controls
   - See points awarded!

## 📈 What Gets Loaded

### Process Areas (3)
1. **Ensure Safe Production (ESP)** - 16 controls
   - Manage Abnormal Situations (7)
   - Ensure Plan Delivery (4)
   - Proactive Monitoring (4)
   - Manage Limits and Alarms (8)

2. **Control of Work** - 7 controls
   - Work Hazard Management
   - Work Planning & Authorization
   - Work Execution Control
   - Personal Protective Equipment (PPE)

3. **Contractor HSSE Management** - 6 controls
   - Contractor Selection & Risk Assessment
   - Contractor Capability Assessment
   - Contract HSSE Requirements
   - Contractor Mobilization & Readiness
   - Contractor Performance Monitoring
   - Contract Closeout & Evaluation

### Control Attributes
Each control includes:
- ✅ Name and detailed statement
- ✅ Control Type (Procedural, Analytical, etc.)
- ✅ HSSE-Critical flag for risk prioritization
- ✅ Risk weight (3 for HSSE-critical, 1 for standard)
- ✅ Health score (default 80)
- ✅ Links to Process Area and Sub-Process

## 🎮 Then Test Gamification

Once controls are loaded:

1. **Plan an FLA** → +50 points
2. **Add controls from any process area** to the FLA
3. **Mark controls as tested** → +100-150 points (bonus for HSSE-critical)
4. **See progress** on the gamification dashboard

Example testing flow:
- Plan "Q2 FLA - ESP Controls"
- Add "Immediate Response - SSS" control (HSSE-critical)
- Test it with detailed evidence
- See **+150 points** awarded
- Check dashboard - you'll have the "First Test" badge!

## 🔧 Troubleshooting

### "Control statements JSON not found"
- Make sure you copied the file to `prisma/seam_control_statements.json`
- Check the file exists: `ls prisma/seam*.json`

### "Controls not appearing in UI"
- Restart dev server: `npm run dev`
- Hard refresh browser: `Ctrl+Shift+R`
- Check database: `sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Control;"`

### "Duplicate controls created"
- It's safe to run the seed again - duplicates are skipped
- Each run only creates controls that don't already exist

## ✨ Next Steps

1. Run `tsx prisma/seed-controls.ts`
2. Verify controls appear in the app
3. Test the complete gamification flow
4. Celebrate! You now have a full SEAM assurance system 🎉

---

**Questions?** Check the logs - the seed script shows exactly what was created!
