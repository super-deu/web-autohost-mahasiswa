// backend/middleware/adminAuthMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Middleware ini khusus untuk melindungi rute admin
const adminProtect = async (req, res, next) => {
    // Ambil token dari cookie khusus admin, misal 'admin_token'
    const token = req.cookies.admin_token;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Cari user di tabel 'admins'
            const [[admin]] = await db.execute('SELECT id, username FROM admins WHERE id = ?', [decoded.id]);
            if (!admin) {
                 return res.status(401).json({ success: false, message: 'Admin tidak ditemukan' });
            }
            req.admin = admin; // Simpan data admin di request
            next();
        } catch (error) {
            res.status(401).json({ success: false, message: 'Tidak terotentikasi, token tidak valid' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Tidak terotentikasi, tidak ada token' });
    }
};

module.exports = { adminProtect };