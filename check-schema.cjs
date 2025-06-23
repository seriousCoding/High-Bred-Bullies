const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function checkSchema() {
  try {
    // Check for friends/messaging related tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%friend%' OR table_name LIKE '%message%' OR table_name LIKE '%follow%' OR table_name LIKE '%conversation%')
      ORDER BY table_name;
    `);
    
    console.log('Friends/messaging tables:', result.rows);
    
    // Check user_follows table structure if it exists
    const followsCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_follows' 
      ORDER BY ordinal_position;
    `);
    
    console.log('user_follows columns:', followsCheck.rows);
    
    // Check if there are any users for testing
    const usersCheck = await pool.query(`
      SELECT id, username FROM users LIMIT 5;
    `);
    
    console.log('Sample users:', usersCheck.rows);
    
  } catch (error) {
    console.error('Database check error:', error);
  } finally {
    pool.end();
  }
}

checkSchema();