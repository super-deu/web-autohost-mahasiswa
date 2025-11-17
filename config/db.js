// backend/config/db.js
const mysql = require('mysql2/promise');

// Konfigurasi database diambil dari environment variables (.env)
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Membuat connection pool untuk efisiensi
const pool = mysql.createPool(dbConfig);

module.exports = pool;