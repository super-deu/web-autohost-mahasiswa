// backend/admin-server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const { adminProtect } = require('./middleware/adminAuthMiddleware');
const { loginAdmin } = require('./controllers/adminAuthController');

const app = express();
const ADMIN_PORT = process.env.ADMIN_PORT || 3797;
const HOST_IP = process.env.HOST_IP || '127.0.0.1';
const ADMIN_FRONTEND_PORT = 5050; // Port frontend admin Anda

// Konfigurasi CORS
app.use(cors({ 
    origin: [`http://localhost:${ADMIN_FRONTEND_PORT}`, `http://${HOST_IP}:${ADMIN_FRONTEND_PORT}`], 
    credentials: true 
}));

// Middleware lain
app.use(cookieParser());
app.use(express.json());


// --- RUTE-RUTE ADMIN ---

// Rute Publik
app.post('/admin/login', loginAdmin);

// Rute Terproteksi
app.get('/admin/check-auth', adminProtect, (req, res) => {
    // Jika middleware 'adminProtect' lolos, berarti token/cookie valid.
    res.json({ success: true, admin: req.admin });
});

app.post('/admin/logout', (req, res) => {
    // Hapus cookie dengan mengeset masa berlakunya ke masa lalu
    res.cookie('admin_token', '', {
        httpOnly: true,
        expires: new Date(0)
    });
    res.status(200).json({ success: true, message: 'Logout berhasil' });
});

app.get('/admin/projects', adminProtect, async (req, res) => { /* ... (tidak berubah) */ });
app.get('/admin/users', adminProtect, async (req, res) => { /* ... (tidak berubah) */ });

// Sajikan file statis HANYA setelah semua rute API didefinisikan
app.use(express.static('public_admin'));


app.listen(ADMIN_PORT, HOST_IP, () => {
    console.log(`🚀 Server Admin berjalan di http://${HOST_IP}:${ADMIN_PORT}`);
});