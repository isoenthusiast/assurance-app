#!/usr/bin/env python3
import json
from collections import defaultdict

# Load the JSON file
with open('seam_control_statements_complete_all_167_verified.json', 'r') as f:
    data = json.load(f)

# Get metadata
metadata = data.get('metadata', {})
controls = data.get('controls', [])

# Verify structure
print("=" * 80)
print("SEAM CONTROL EXTRACTION VERIFICATION REPORT")
print("=" * 80)
print()

# Metadata verification
print("METADATA VERIFICATION:")
print(f"  Total Controls Reported: {metadata.get('totalControls', 'N/A')}")
print(f"  Total Practices Target: {metadata.get('totalPractices', 'N/A')}")
print(f"  Practices Processed: {metadata.get('practicesProcessed', 'N/A')}")
print(f"  Completion Date: {metadata.get('completionDate', 'N/A')}")
print(f"  Verification Status: {metadata.get('verificationStatus', 'N/A')}")
print(f"  Average per Practice: {metadata.get('averageControlsPerPractice', 'N/A')}")
print()

# Actual control count
actual_count = len(controls)
print(f"CONTROL COUNT VERIFICATION:")
print(f"  Actual controls in array: {actual_count}")
print(f"  Metadata reports: {metadata.get('totalControls', 'N/A')}")
print(f"  Match: {'✓ YES' if actual_count == metadata.get('totalControls') else '✗ NO'}")
print()

# Unique practices
unique_practices = defaultdict(int)
for control in controls:
    practice = control.get('practiceDocument', 'UNKNOWN')
    unique_practices[practice] += 1

print(f"PRACTICE COVERAGE:")
print(f"  Unique practices found: {len(unique_practices)}")
print(f"  Target practices: 167")
print(f"  Coverage: {len(unique_practices)}/167")
print()

# Field completeness
required_fields = [
    'controlId', 'practiceDocument', 'processArea', 'processNumber',
    'subProcess', 'controlName', 'controlStatement', 'controlType',
    'isHSSECritical', 'keyActivities', 'riskAddressed', 'testingApproach'
]

incomplete_controls = []
for i, control in enumerate(controls):
    missing_fields = [field for field in required_fields if field not in control or not control[field]]
    if missing_fields:
        incomplete_controls.append({
            'index': i,
            'controlId': control.get('controlId', 'UNKNOWN'),
            'missing': missing_fields
        })

print(f"FIELD COMPLETENESS:")
print(f"  Controls with all required fields: {actual_count - len(incomplete_controls)}/{actual_count}")
if incomplete_controls:
    print(f"  Controls with missing fields: {len(incomplete_controls)}")
    for incomplete in incomplete_controls[:5]:
        print(f"    - {incomplete['controlId']}: missing {incomplete['missing']}")
else:
    print(f"  ✓ All controls complete")
print()

# HSSE Critical assessment
hsse_critical_count = sum(1 for c in controls if c.get('isHSSECritical'))
print(f"HSSE CRITICAL CONTROLS:")
print(f"  Total HSSE Critical: {hsse_critical_count}/{actual_count}")
print(f"  Percentage: {(hsse_critical_count/actual_count*100):.1f}%")
print()

# Control type distribution
control_types = defaultdict(int)
for control in controls:
    ct = control.get('controlType', 'UNKNOWN')
    control_types[ct] += 1

print(f"CONTROL TYPE DISTRIBUTION:")
for ct in sorted(control_types.keys()):
    print(f"  {ct}: {control_types[ct]}")
print()

# Key activities verification
min_activities = 5
max_activities = 7
activity_stats = []
for control in controls:
    acts = control.get('keyActivities', [])
    activity_stats.append(len(acts))

print(f"KEY ACTIVITIES VERIFICATION (target 5-7):")
print(f"  Average activities per control: {sum(activity_stats)/len(activity_stats):.1f}")
print(f"  Min activities: {min(activity_stats)}")
print(f"  Max activities: {max(activity_stats)}")
print(f"  Controls with 5-7 activities: {sum(1 for a in activity_stats if 5 <= a <= 7)}/{len(activity_stats)}")
print()

# Summary
print("=" * 80)
print("OVERALL ASSESSMENT:")
is_valid = (
    actual_count == metadata.get('totalControls') and
    len(incomplete_controls) == 0 and
    len(unique_practices) == 167
)
print(f"  JSON Valid: {'✓ YES' if is_valid else '✗ NO'}")
print(f"  All 167 practices covered: {'✓ YES' if len(unique_practices) == 167 else '✗ NO'}")
print(f"  All fields complete: {'✓ YES' if not incomplete_controls else '✗ NO'}")
print(f"  Average controls/practice: {actual_count/167:.2f}")
print()

# Print unique practices summary
print("FIRST 20 PRACTICES (by appearance):")
practices_list = list(unique_practices.keys())
for i, practice in enumerate(practices_list[:20], 1):
    print(f"  {i:3d}. {practice}: {unique_practices[practice]} controls")

print()
print("=" * 80)
