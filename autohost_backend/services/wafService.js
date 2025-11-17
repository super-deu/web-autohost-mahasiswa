// backend/services/wafService.js
const axios = require('axios');

const {
  CLOUDFLARE_WAF_API_TOKEN,
  CLOUDFLARE_ZONE_ID,
  CLOUDFLARE_WAF_RULESET_ID,
  CLOUDFLARE_WAF_RULE_ID,
  DOMAIN,
  PLACEHOLDER_DOMAIN,
} = process.env;

const cfApi = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4',
  headers: { 'Authorization': `Bearer ${CLOUDFLARE_WAF_API_TOKEN}` }
});

const PLACEHOLDER_EXPRESSION = `(http.host eq "${PLACEHOLDER_DOMAIN}")`;

/**
 * Ambil detail aturan WAF berdasarkan RULE_ID
 */
async function getWafRule() {
  try {
    const rulesetEndpoint = `/zones/${CLOUDFLARE_ZONE_ID}/rulesets/${CLOUDFLARE_WAF_RULESET_ID}`;
    const { data: { result: ruleset } } = await cfApi.get(rulesetEndpoint);

    const rule = ruleset.rules.find(r => r.id === CLOUDFLARE_WAF_RULE_ID);
    if (!rule) throw new Error(`Aturan WAF dengan ID ${CLOUDFLARE_WAF_RULE_ID} tidak ditemukan.`);

    return rule;
  } catch (error) {
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    throw new Error(`Gagal mengambil aturan WAF: ${errorMsg}`);
  }
}

/**
 * Helper: parse expression jadi array host
 */
function parseHosts(expression) {
  return expression
    .split(" or ")
    .map(exp => exp.trim())
    .filter(exp => exp.startsWith("(http.host eq"));
}

/**
 * Helper: build ulang expression dari array host
 */
function buildExpression(hosts) {
  return hosts.length > 0 ? hosts.join(" or ") : PLACEHOLDER_EXPRESSION;
}

/**
 * Tambah host ke WAF rule
 */
async function addHostToWaf(subdomain) {
  const hostname = `${subdomain}.${DOMAIN}`;
  const rule = await getWafRule();

  let hosts = parseHosts(rule.expression);

  // jika masih placeholder, ganti dengan host baru
  if (hosts.includes(PLACEHOLDER_EXPRESSION)) {
    hosts = [`(http.host eq "${hostname}")`];
  } else {
    hosts.push(`(http.host eq "${hostname}")`);
  }

  const payload = {
    expression: buildExpression(hosts),
    action: rule.action,
    description: rule.description,
    enabled: rule.enabled
  };

  const ruleUpdateEndpoint = `/zones/${CLOUDFLARE_ZONE_ID}/rulesets/${CLOUDFLARE_WAF_RULESET_ID}/rules/${CLOUDFLARE_WAF_RULE_ID}`;
  await cfApi.patch(ruleUpdateEndpoint, payload);

  console.log(`✅ Hostname ${hostname} berhasil ditambahkan ke WAF Protection Rule.`);
}

/**
 * Hapus host dari WAF rule
 */
async function removeHostFromWaf(subdomain) {
  const hostname = `${subdomain}.${DOMAIN}`;
  try {
    const rule = await getWafRule();
    let hosts = parseHosts(rule.expression);

    hosts = hosts.filter(exp => exp !== `(http.host eq "${hostname}")`);

    const payload = {
      expression: buildExpression(hosts),
      action: rule.action,
      description: rule.description,
      enabled: rule.enabled
    };

    const ruleUpdateEndpoint = `/zones/${CLOUDFLARE_ZONE_ID}/rulesets/${CLOUDFLARE_WAF_RULESET_ID}/rules/${CLOUDFLARE_WAF_RULE_ID}`;
    await cfApi.patch(ruleUpdateEndpoint, payload);

    console.log(`🧹 Hostname ${hostname} berhasil dihapus dari WAF Protection Rule.`);
  } catch (error) {
    console.error(`Gagal cleanup WAF rule: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
}

module.exports = { addHostToWaf, removeHostFromWaf };
