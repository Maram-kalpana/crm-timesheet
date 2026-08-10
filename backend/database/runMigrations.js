require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const run = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hrms_db',
    multipleStatements: true,
  });

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await conn.query(sql);
      console.log(`[Migration] OK: ${file}`);
    } catch (err) {
      console.warn(`[Migration] ${file}: ${err.message}`);
    }
  }

  await conn.end();
  console.log('[Migration] Done.');
};

run().catch((err) => {
  console.error('[Migration] Failed:', err.message);
  process.exit(1);
});
