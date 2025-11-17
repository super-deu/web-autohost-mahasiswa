// backend/controllers/adminAuthController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '8h' });
};

const loginAdmin = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [[admin]] = await db.execute('SELECT * FROM admins WHERE username = ?', [username]);
        if (admin && (await bcrypt.compare(password, admin.password))) {
            const token = generateToken(admin.id);
            res.cookie('admin_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 8 * 60 * 60 * 1000 // 8 jam
            });
            res.json({ success: true, message: 'Login admin berhasil' });
        } else {
            res.status(401).json({ success: false, message: 'Username atau password admin salah' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { loginAdmin };