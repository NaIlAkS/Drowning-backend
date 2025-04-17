const { Pool } = require('pg');

// Use the database URL directly from Render (replace with your actual URL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,  // Render provides this environment variable
    ssl: {
        rejectUnauthorized: false,  // Required for secure connections on Render
    },
});

// Test the connection
pool.connect()
    .then(client => {
        console.log('✅ Database connected successfully');
        client.release(); // Release the connection back to the pool
    })
    .catch(err => console.error('❌ Database connection error:', err.stack));

module.exports = pool;

