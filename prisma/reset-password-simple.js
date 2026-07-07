const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Open the database
const db = new Database("./data/dev.db");

// Generate new password
const newPassword = crypto.randomBytes(9).toString("base64url");
const passwordHash = bcrypt.hashSync(newPassword, 10);

// Update admin user
const stmt = db.prepare(
  'UPDATE "User" SET "passwordHash" = ? WHERE "username" = ?'
);
const result = stmt.run(passwordHash, "admin");

if (result.changes === 0) {
  console.error("❌ Admin user not found!");
  process.exit(1);
}

db.close();

console.log("✅ Admin password reset successfully!");
console.log("  username: admin");
console.log(`  password: ${newPassword}`);
console.log("⚠️  Save this password now — it will not be shown again.");
