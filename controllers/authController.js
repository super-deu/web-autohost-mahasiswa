// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const apacheService = require('../services/apacheService');
const cloudflareService = require('../services/cloudflareService');
const wafService = require('../services/wafService');

// Fungsi untuk membuat token JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d', // Token berlaku 1 hari
    });
};

const registerUser = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Harap isi semua field' });
    }

    const [[userExists]] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (userExists) {
        return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Simpan user baru
    const [result] = await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    
    if (result.insertId) {
        const token = generateToken(result.insertId);
        // KIRIM TOKEN VIA COOKIE
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // true jika pakai HTTPS
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 hari
        });
        res.status(201).json({
            success: true,
            _id: result.insertId,
            username: username
        });
    } else {
        res.status(400).json({ success: false, message: 'Data user tidak valid' });
    }
};

const loginUser = async (req, res) => {
    const { username, password } = req.body;
    const [[user]] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);

    if (user && (await bcrypt.compare(password, user.password))) {
        const token = generateToken(user.id);
        // KIRIM TOKEN VIA COOKIE
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });
        res.json({
            success: true,
            _id: user.id,
            username: user.username
        });
    } else {
        res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
};

/**
 * Menghapus akun pengguna yang sedang login beserta semua asetnya.
 */
const deleteMyAccount = async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. Ambil semua proyek milik user ini sebelum dihapus dari DB
        const [projects] = await db.execute('SELECT subdomain FROM projects WHERE user_id = ?', [userId]);

        // 2. Lakukan semua proses cleanup untuk setiap proyek
        console.log(`Memulai proses cleanup untuk ${projects.length} proyek milik user ID ${userId}...`);
        for (const project of projects) {
            const subdomain = project.subdomain;
            console.log(`- Membersihkan subdomain: ${subdomain}`);
            await apacheService.cleanup(subdomain);
            await cloudflareService.removeHostnameFromTunnel(subdomain);
            await cloudflareService.deleteDnsRecord(subdomain);
            await wafService.removeHostFromWaf(subdomain);
        }

        // 3. Hapus user dari database (proyek akan terhapus otomatis karena ON DELETE CASCADE)
        await db.execute('DELETE FROM users WHERE id = ?', [userId]);

        // 4. Hapus cookie di sisi klien
        res.cookie('token', '', {
            httpOnly: true,
            expires: new Date(0)
        });

        res.status(200).json({ success: true, message: 'Akun Anda dan semua proyek terkait telah berhasil dihapus.' });

    } catch (error) {
        console.error(`Gagal menghapus akun user ID ${userId}: ${error.message}`);
        // Cetak stack trace untuk debugging yang lebih mudah
        console.error(error); 
        res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mencoba menghapus akun.' });
    }
};

module.exports = { registerUser, loginUser, deleteMyAccount };