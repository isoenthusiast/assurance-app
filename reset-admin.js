const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

// Use the dev.db in the seam-assurance-app directory
const dbPath = path.join(__dirname, 'seam-assurance-app', 'dev.db');

// Generate new password
const newPassword = crypto.randomBytes(9).toString('base64url');
console.log('Generating password hash...');
const passwordHash = bcrypt.hashSync(newPassword, 10);

// Connect to database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Cannot connect to database:', err);
    process.exit(1);
  }

  // Update admin password
  db.run(
    'UPDATE "User" SET "passwordHash" = ? WHERE "username" = ?',
    [passwordHash, 'admin'],
    function(err) {
      if (err) {
        console.error('❌ Database error:', err);
        db.close();
        process.exit(1);
      }

      if (this.changes === 0) {
        console.error('❌ Admin user not found!');
        db.close();
        process.exit(1);
      }

      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err);
          process.exit(1);
        }

        console.log('✅ Admin password reset successfully!');
        console.log('  username: admin');
        console.log(`  password: ${newPassword}`);
        console.log('⚠️  Save this password now — it will not be shown again.');
      });
    }
  );
});
