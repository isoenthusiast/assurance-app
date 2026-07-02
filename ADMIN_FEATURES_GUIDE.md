# Admin Features Guide - SEAM Assurance App

## 📋 Overview

The SEAM Assurance App now includes comprehensive admin features for managing database tables, columns, and importing CSV data directly from the user interface.

---

## 🚀 New Features

### 1. Admin Dashboard
**Access:** `/admin`

The central hub for all admin operations featuring:
- Quick links to all admin features
- Table browser with descriptions
- Important notes and warnings

### 2. Column Management
**Access:** `/admin/columns`

Manage database table columns without touching code:
- **View Columns**: See all columns in any table with data types and constraints
- **Add Columns**: Add new columns to tables with customizable data types
- **Remove Columns**: Delete columns (except primary keys)
- **Column Details**: View whether column is required, primary key, etc.

#### Supported Data Types:
- String (Text)
- Int (Integer)
- Float (Decimal)
- Boolean (True/False)
- DateTime (Date & Time)
- JSON (Complex Data)

### 3. CSV Import
**Access:** `/admin/import-csv`

Upload CSV files to populate tables with data:
- **Select Table**: Choose which table to import to
- **Upload CSV**: Drag & drop or click to select file
- **Download Template**: Get example CSV format
- **Validation**: Automatic data type checking
- **Error Reporting**: Detailed error and warning messages

#### Currently Supported Tables:
- ProcessArea
- SubProcess
- Control
- (More tables can be easily added)

---

## 🔐 Security & Permissions

### Admin Requirements
Only users with role "Admin" can access these features.

### Implementation
The app checks user role in two places:
1. **Backend**: API routes verify `session.user.role === 'Admin'`
2. **Frontend**: Client-side check with graceful error handling

### Setting Admin Role
Update your user's role in the database:
```sql
UPDATE "User" SET role = 'Admin' WHERE username = 'your_username';
```

---

## 📂 File Structure

New files added to your application:

```
src/app/admin/
├── page.tsx                          # Admin dashboard
├── columns/
│   └── page.tsx                      # Column management interface
└── import-csv/
    └── page.tsx                      # CSV import interface

src/app/api/admin/
├── check/route.ts                    # Verify admin access
├── tables/route.ts                   # List available tables
├── table/[table]/columns/
│   ├── route.ts                      # Get/add columns
│   └── [column]/route.ts             # Delete column
└── import-csv/route.ts               # Process CSV upload
```

---

## 🎯 How to Use

### Accessing Admin Panel

1. **Navigate to Admin Dashboard**
   ```
   http://localhost:3000/admin
   ```

2. **Verify You're Admin**
   - If you see "Access Denied", update your user role in database
   - Set role to "Admin" for the current user

3. **Choose Your Operation**
   - Manage Columns
   - Import CSV
   - Export Data (future feature)

### Adding a Column

1. Go to `/admin/columns`
2. Select a table from dropdown
3. View current columns in the table
4. Scroll to "Add New Column" section
5. Enter:
   - Column Name (e.g., `email`)
   - Data Type (e.g., String)
   - Required checkbox if mandatory
6. Click "➕ Add Column"
7. Verify success message

### Importing CSV Data

1. Go to `/admin/import-csv`
2. Select the target table
3. Click "Download Template" for example format
4. Fill template with your data in CSV format
5. Upload the CSV file
6. Review import results
7. Check for errors/warnings

#### CSV Format Requirements:

**Headers (First Row):**
- Must match column names exactly
- Column names are case-sensitive

**Data Format:**
```csv
name,description,processAreaId
"AIPSM","Asset Integrity and Process Safety Management",pa_123
"Risk Management","Risk Management Practice",pa_456
```

**Data Types:**
- String: Any text (optional quotes)
- Int: Whole numbers
- Float: Decimal numbers
- Boolean: "true", "false", "1", "0"
- DateTime: ISO 8601 format (2024-01-15T10:30:00Z)
- NULL: Leave empty or don't include

**Special Cases:**
- Empty cells = NULL/empty value
- Quotes around text: Use `"` to escape commas
- Dates: Use format `YYYY-MM-DDTHH:mm:ssZ`

---

## 📊 CSV Import Examples

### ProcessArea Table
```csv
name,description
"AIPSM","Asset Integrity and Process Safety Management"
"Risk Management","Management of HSSE & SP Risks to ALARP"
"Biodiversity and Ecosystems","Biodiversity and Ecosystem Management"
```

### SubProcess Table
```csv
name,processAreaId,description
"5 Year Process Hazard Analysis","pa_001","Five-year HAZOP cycle process"
"AIPSM 2nd Line Assurance","pa_001","Second line assurance activities"
```

### Control Table
```csv
name,statement,controlType,processAreaId,subProcessId,isHsseCritical
"Establish HAZOP Plan","Each Asset must establish a HAZOP plan...","Administrative","pa_001","sp_001","true"
"Conduct Assessment","A structured technical assessment...","Procedural","pa_001","sp_001","false"
```

---

## ⚙️ API Endpoints

### Admin Check
```
GET /api/admin/check
```
Verify if current user is admin
- Returns 200 if admin
- Returns 401 if not authenticated
- Returns 403 if not admin

### Get Tables List
```
GET /api/admin/tables
```
Get list of available tables for management

### Get Table Columns
```
GET /api/admin/table/[table]/columns
```
Get all columns for specified table with metadata

### Add Column
```
POST /api/admin/table/[table]/columns
Body: {
  "name": "email",
  "type": "String",
  "required": true
}
```

### Delete Column
```
DELETE /api/admin/table/[table]/columns/[column]
```
Remove a column from table (cannot delete primary keys)

### Import CSV
```
POST /api/admin/import-csv
Body: FormData {
  file: File,
  table: "ProcessArea"
}
```
Upload and process CSV file

---

## ✅ Validation & Error Handling

### CSV Validation
- Headers must match column names
- Data types must be compatible
- Required fields cannot be empty
- Foreign keys are verified

### Error Messages
The system provides specific error feedback:
```
Row 3: Missing required field 'name'
Row 5: ProcessArea pa_999 not found
Row 8: Invalid DateTime format
```

### Warnings
Non-critical issues that don't prevent import:
```
Row 2: ProcessArea pa_888 not found (skipped)
Row 7: Duplicate entry (skipped)
```

---

## 🔄 Next Steps & Future Enhancements

### Phase 2 Features to Add:
1. **Export Data**: Download any table as CSV
2. **Bulk Updates**: Update multiple rows from CSV
3. **Schema Editor**: Edit column properties
4. **Data Validation**: Custom validation rules
5. **Audit Log**: Track all admin changes
6. **Backup/Restore**: Database backup interface

### Implementation Notes:
- CSV import currently supports ProcessArea, SubProcess, Control
- Easy to add more tables by following the same pattern
- Column addition/deletion requires database migration
- See `src/app/api/admin/import-csv/route.ts` for extension examples

---

## 🐛 Troubleshooting

### "Access Denied" Error
**Problem**: Not authorized to access admin panel
**Solution**: Set user role to "Admin" in database
```sql
UPDATE "User" SET role = 'Admin' WHERE id = 'user_id';
```

### CSV Upload Fails
**Problem**: Import shows errors
**Solution**:
1. Check column names match exactly
2. Verify data types are correct
3. Download template and compare format
4. Check for extra spaces or special characters

### Column Management Not Working
**Problem**: Can't see tables or columns
**Solution**:
1. Clear browser cache
2. Verify admin access first
3. Check API response in browser console
4. Ensure database connection is active

---

## 📖 Example Workflow

### Scenario: Add Risk Assessment Process Area

1. **Create CSV File**
   ```csv
   name,description
   "Risk Assessment","Management of Risk Assessment Activities"
   ```

2. **Go to Import CSV**
   - Navigate to `/admin/import-csv`
   - Select "ProcessArea" table
   - Upload the CSV file

3. **Verify Results**
   - Should show "✅ Import Successful"
   - Rows Imported: 1
   - No errors or warnings

4. **Add Sub-Process**
   - Create new CSV for SubProcess table
   - Include the ProcessArea ID from step 3
   - Upload and verify

---

## 🔒 Best Practices

### Before Making Changes:
- ✅ Backup your database
- ✅ Test CSV format with template first
- ✅ Review error messages carefully
- ✅ Use descriptive column names

### When Adding Columns:
- ✅ Choose appropriate data types
- ✅ Mark required fields correctly
- ✅ Consider existing data constraints
- ✅ Document custom fields

### When Importing Data:
- ✅ Download template first
- ✅ Validate data before upload
- ✅ Check for duplicate entries
- ✅ Verify foreign key relationships

### Security:
- ✅ Only Admin role can access
- ✅ All changes are logged (implement audit)
- ✅ Always backup before bulk operations
- ✅ Use strong authentication

---

## 📞 Support & Documentation

For more help:
1. Check error messages for specific issues
2. Review CSV format requirements
3. Verify admin role and permissions
4. Check API endpoints documentation above

---

## 🎉 Summary

The Admin Features provide:
- ✅ User-friendly column management without code
- ✅ Bulk data import via CSV files
- ✅ Data validation and error reporting
- ✅ Secure admin-only access control
- ✅ Extensible architecture for future features

Start using these features to manage your SEAM Assurance App data efficiently!
