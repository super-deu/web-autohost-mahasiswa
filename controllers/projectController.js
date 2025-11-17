// backend/controllers/projectController.js
const fs = require('fs');
const AdmZip = require('adm-zip');
const fsp = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../config/db');
const apacheService = require('../services/apacheService');
const cloudflareService = require('../services/cloudflareService');
const wafService = require('../services/wafService'); // <- Impor service baru
const { exec } = require('child_process');

// Fungsi untuk mengecek ketersediaan subdomain (Publik)
const checkSubdomain = async (req, res) => {
    try {
        const { subdomain } = req.params;

        // --- PENAMBAHAN: Pengecualian untuk subdomain 'web' ---
        if (subdomain.toLowerCase() === 'web') {
            return res.json({ available: false, message: 'Subdomain "web" tidak dapat digunakan.' });
        }
        // --- Akhir Penambahan ---

        const [[project]] = await db.execute('SELECT id FROM projects WHERE subdomain = ?', [subdomain]);
        if (project) {
            res.json({ available: false, message: 'Subdomain sudah digunakan.' });
        } else {
            res.json({ available: true, message: 'Subdomain tersedia!' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Fungsi untuk deploy proyek (Privat)
const deployProject = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'File proyek tidak ditemukan.' });
    }

    const { projectName, subdomain } = req.body;
    const tempFilePath = req.file.path;
    const publicUrl = `https://${subdomain}.${process.env.DOMAIN}`;
    const projectPath = `/var/www/projects/${subdomain}`;

    try {
        // --- PENAMBAHAN: Pengecualian untuk subdomain 'web' ---
        if (subdomain.toLowerCase() === 'web') {
            return res.status(400).json({ 
                success: false, 
                message: 'Subdomain "web" adalah nama yang dilindungi dan tidak dapat digunakan.' 
            });
        }
        // --- Akhir Penambahan ---
        
        const [[existingProject]] = await db.execute('SELECT id FROM projects WHERE subdomain = ?', [subdomain]);
        if (existingProject) {
            return res.status(400).json({ success: false, message: 'Subdomain sudah digunakan. Silakan pilih nama lain.' });
        }

        const form = new FormData();
        form.append('projectFile', fs.createReadStream(tempFilePath), req.file.originalname);
        
        // =============================================================
        // === PERBAIKAN FINAL: HAPUS HEADER MANUAL, BIARKAN AXIOS BEKERJA ===
        // =============================================================
        const validationResponse = await axios.post(process.env.VALIDATOR_URL, form);
        if (validationResponse.status !== 200 || !validationResponse.data.success) {
             throw new Error(`Validasi Gagal: ${validationResponse.data.message || 'Validator menolak file.'}`);
        }

        await fsp.mkdir(projectPath, { recursive: true });
        const zip = new AdmZip(tempFilePath);
        zip.extractAllTo(projectPath, true);
        await new Promise(resolve => exec(`sudo chown -R www-data:www-data ${projectPath}`, resolve));

        const allocatedPort = await apacheService.deploy(subdomain);
        await cloudflareService.addHostnameToTunnel(subdomain, allocatedPort);
        await cloudflareService.createDnsRecord(subdomain);
        await wafService.addHostToWaf(subdomain);

        await db.execute(
            'INSERT INTO projects (project_name, subdomain, public_url, user_id) VALUES (?, ?, ?, ?)',
            [projectName, subdomain, publicUrl, req.user.id]
        );

        res.status(201).json({ success: true, message: 'Proyek berhasil di-deploy dan diamankan!', url: publicUrl });

    } catch (error) {
        console.error(`Error Deploy: ${error.message}`);
        await fsp.rm(projectPath, { recursive: true, force: true }).catch(()=>{});
        await apacheService.cleanup(subdomain);
        await cloudflareService.removeHostnameFromTunnel(subdomain);
        await cloudflareService.deleteDnsRecord(subdomain);
        await wafService.removeHostFromWaf(subdomain);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        await fsp.unlink(tempFilePath);
    }
};

// Fungsi untuk mengambil proyek milik user (Privat)
const getMyProjects = async (req, res) => {
    try {
        const [projects] = await db.execute('SELECT id, project_name, subdomain, public_url, status FROM projects WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.status(200).json({ success: true, projects });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil daftar proyek' });
    }
};

// Fungsi untuk menghapus proyek (Privat)
const deleteProject = async (req, res) => {
    const { id, subdomain } = req.params;
    const userId = req.user.id;
    try {
        const [[project]] = await db.execute('SELECT * FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Proyek tidak ditemukan atau Anda tidak punya izin' });
        }
        const projectPath = `/var/www/projects/${subdomain}`;
        await fsp.rm(projectPath, { recursive: true, force: true }).catch(()=>{});
        await apacheService.cleanup(subdomain);
        await cloudflareService.removeHostnameFromTunnel(subdomain);
        await cloudflareService.deleteDnsRecord(subdomain);
        await wafService.removeHostFromWaf(subdomain);
        await db.execute('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
        res.status(200).json({ success: true, message: 'Proyek berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus proyek' });
    }
};


module.exports = { deployProject, getMyProjects, deleteProject, checkSubdomain };