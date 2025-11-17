// backend/services/cloudflareService.js
const axios = require('axios');

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_TUNNEL_ID, HOST_IP, CLOUDFLARE_ZONE_ID } = process.env;

// Instance API untuk manajemen umum (termasuk DNS)
const cfApi = axios.create({
    baseURL: 'https://api.cloudflare.com/client/v4',
    headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` }
});

// Instance API khusus untuk endpoint Tunnel
const cfTunnelApi = axios.create({
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}`,
    headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` }
});


// --- FUNGSI MANAJEMEN DNS DENGAN LOGGING ---

async function createDnsRecord(subdomain) {
    const fullName = `${subdomain}.${process.env.DOMAIN}`;
    const endpoint = `/zones/${CLOUDFLARE_ZONE_ID}/dns_records`;
    const payload = {
        type: 'CNAME',
        name: subdomain,
        content: process.env.CLOUDFLARE_TUNNEL_HOSTNAME,
        proxied: true,
        ttl: 1,
        comment: 'Dibuat oleh AutoHost System'
    };

    try {
        console.log(`LOG: Akan mengirim (POST) ke endpoint: ${endpoint}`);
        console.log("LOG: Payload DNS:", JSON.stringify(payload, null, 2));
        await cfApi.post(endpoint, payload);
        console.log(`CNAME record untuk ${fullName} berhasil dibuat.`);
    } catch (error) {
        console.error(`LOG: Gagal mengirim (POST) ke ${endpoint} dengan status ${error.response?.status}`);
        console.error("LOG: Error Response Body dari Cloudflare (DNS):", JSON.stringify(error.response?.data, null, 2));
        throw new Error(`Gagal membuat DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
}

async function deleteDnsRecord(subdomain) {
    const fullName = `${subdomain}.${process.env.DOMAIN}`;
    const endpoint = `/zones/${CLOUDFLARE_ZONE_ID}/dns_records`;

    try {
        const { data: { result } } = await cfApi.get(endpoint, { params: { name: fullName } });
        if (result && result.length > 0) {
            const recordId = result[0].id;
            console.log(`LOG: Akan menghapus (DELETE) DNS record ID ${recordId}...`);
            await cfApi.delete(`${endpoint}/${recordId}`);
            console.log(`DNS record untuk ${fullName} berhasil dihapus.`);
        }
    } catch (error) {
        console.error(`LOG: Gagal saat proses hapus DNS dengan status ${error.response?.status}`);
        console.error("LOG: Error Response Body dari Cloudflare (DNS):", JSON.stringify(error.response?.data, null, 2));
        throw new Error(`Gagal menghapus DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
}


// --- FUNGSI MANAJEMEN TUNNEL ---

async function getCurrentConfig() {
    const { data } = await cfTunnelApi.get('/configurations');
    if (!data.result || !data.result.config || !data.result.config.ingress) {
        return { ingress: [{ service: 'http_status:404' }] };
    }
    return data.result.config;
}

async function addHostnameToTunnel(subdomain, port) {
    const hostname = `${subdomain}.${process.env.DOMAIN}`;
    const config = await getCurrentConfig();
    const newRule = { hostname, service: `http://${HOST_IP}:${port}` };
    const catchAllRule = { service: 'http_status:404' };
    const otherRules = config.ingress.filter(rule => rule.hostname && rule.hostname !== hostname);
    config.ingress = [...otherRules, newRule, catchAllRule];
    await cfTunnelApi.put('/configurations', { config });
    console.log(`Hostname ${hostname} -> ${newRule.service} berhasil ditambahkan ke Tunnel.`);
}

async function removeHostnameFromTunnel(subdomain) {
    const hostname = `${subdomain}.${process.env.DOMAIN}`;
    try {
        const config = await getCurrentConfig();
        const initialLength = config.ingress.length;
        const otherRules = config.ingress.filter(rule => rule.hostname && rule.hostname !== hostname);
        const catchAllRule = { service: 'http_status:404' };
        config.ingress = [...otherRules, catchAllRule];
        if (config.ingress.length <= initialLength) {
            await cfTunnelApi.put('/configurations', { config });
            console.log(`Hostname ${hostname} berhasil dihapus dari tunnel.`);
        }
    } catch (error) {
        console.error(`Gagal cleanup hostname di Cloudflare: ${error.message}`);
    }
}

module.exports = { 
    createDnsRecord, 
    deleteDnsRecord,
    addHostnameToTunnel,
    removeHostnameFromTunnel
};