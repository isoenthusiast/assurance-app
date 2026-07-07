const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Generate admin password
const adminPassword = crypto.randomBytes(9).toString('base64url');
const passwordHash = bcrypt.hashSync(adminPassword, 10);

try {
  // Open database
  const db = new Database('data/dev.db');

  // Check if admin already exists
  const existing = db.prepare('SELECT id FROM "User" WHERE username = ?').get('admin');

  if (existing) {
    console.log('Admin user already exists. Updating password...');
    db.prepare('UPDATE "User" SET "passwordHash" = ? WHERE username = ?').run(passwordHash, 'admin');
  } else {
    console.log('Creating new admin user...');
    const id = crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex');
    db.prepare(
      `INSERT INTO "User" (id, name, username, "passwordHash", role, "createdAt")
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, 'Admin', 'admin', passwordHash, 'Admin');
  }

  db.close();

  console.log('\n✅ Admin user ready!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  username: admin');
  console.log(`  password: ${adminPassword}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  Save this password now!');
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
