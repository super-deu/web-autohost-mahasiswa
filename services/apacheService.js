// backend/services/apacheService.js
const { exec } = require('child_process');
const fsp = require('fs').promises;
const path = require('path');
const portfinder = require('portfinder');

portfinder.basePort = 8000;
const APACHE_SITES_AVAILABLE = '/etc/apache2/sites-available';
const APACHE_PORTS_CONF = '/etc/apache2/ports.conf';

/**
 * Mencari port, membuat VHost, mengupdate ports.conf, dan me-reload Apache.
 * @param {string} subdomain - Nama subdomain proyek.
 * @returns {Promise<number>} - Port yang dialokasikan.
 */
async function deploy(subdomain) {
    const port = await portfinder.getPortPromise();
    const domain = `${subdomain}.${process.env.DOMAIN}`;
    const projectPath = `/var/www/projects/${subdomain}`;

    const projectVhostContent = `
<VirtualHost *:${port}>
    ServerName ${domain}
    DocumentRoot ${projectPath}
    <Directory ${projectPath}>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
    `;

    const confPath = path.join(APACHE_SITES_AVAILABLE, `${domain}.conf`);
    await fsp.writeFile(confPath, projectVhostContent);
    await fsp.appendFile(APACHE_PORTS_CONF, `\nListen ${port}`);

    const command = `sudo a2ensite ${domain}.conf && sudo systemctl reload apache2`;

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error saat deploy Apache: ${stderr}`);
                return reject(new Error(`Gagal mengaktifkan site untuk ${domain}.`));
            }
            console.log(`Site ${domain} di port ${port} berhasil diaktifkan.`);
            resolve(port);
        });
    });
}

/**
 * Menonaktifkan site, menghapus file .conf, dan menghapus port dari ports.conf.
 * @param {string} subdomain - Nama subdomain proyek.
 */
async function cleanup(subdomain) {
    const domain = `${subdomain}.${process.env.DOMAIN}`;
    const confPath = path.join(APACHE_SITES_AVAILABLE, `${domain}.conf`);
    let portToRemove = null;

    try {
        // Langkah 1: Baca file .conf untuk menemukan port yang digunakan
        const confContent = await fsp.readFile(confPath, 'utf-8');
        const match = confContent.match(/<VirtualHost \*:(\d+)>/);
        if (match && match[1]) {
            portToRemove = match[1];
            console.log(`Port ${portToRemove} akan dihapus dari konfigurasi Apache.`);
        }
    } catch (e) {
        console.warn(`Tidak dapat membaca file konfigurasi untuk ${domain}, mungkin sudah dihapus.`);
    }

    // Langkah 2: Nonaktifkan site dan reload Apache
    const command = `sudo a2dissite ${domain}.conf && sudo systemctl reload apache2`;
    await new Promise(resolve => {
        exec(command, (err, stdout, stderr) => {
            if (err) console.error(`Gagal menonaktifkan site ${domain}: ${stderr}`);
            else console.log(`Site ${domain} dinonaktifkan.`);
            resolve();
        });
    });

    // Langkah 3: Hapus file .conf
    await fsp.unlink(confPath).catch(e => {});

    // Langkah 4: Jika port ditemukan, hapus dari ports.conf
    if (portToRemove) {
        try {
            const data = await fsp.readFile(APACHE_PORTS_CONF, 'utf-8');
            const lines = data.split('\n');
            
            // Filter semua baris, KECUALI baris "Listen" dengan port yang mau kita hapus
            const newLines = lines.filter(line => line.trim() !== `Listen ${portToRemove}`);
            
            const newData = newLines.join('\n');
            await fsp.writeFile(APACHE_PORTS_CONF, newData, 'utf-8');
            console.log(`Baris "Listen ${portToRemove}" berhasil dihapus dari ${APACHE_PORTS_CONF}`);
        } catch (e) {
            console.error(`Gagal membersihkan ports.conf: ${e.message}`);
        }
    }
}

module.exports = { deploy, cleanup };