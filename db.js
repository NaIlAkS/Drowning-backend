const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test the connection
pool.connect()
    .then(client => {
        console.log('✅ Database connected successfully');
        client.release(); // Release the connection back to the pool
    })
    .catch(err => console.error('❌ Database connection error:', err.stack));

module.exports = pool;
