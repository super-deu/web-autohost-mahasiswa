// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const protect = async (req, res, next) => {
    // Ambil token dari cookie, bukan dari header
    const token = req.cookies.token;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const [rows] = await db.execute('SELECT id, username FROM users WHERE id = ?', [decoded.id]);
            req.user = rows[0];
            next();
        } catch (error) {
            res.status(401).json({ success: false, message: 'Tidak terotentikasi, token tidak valid' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Tidak terotentikasi, tidak ada token' });
    }
};

module.exports = { protect };