#!/usr/bin/env node
/**
 * Bootstrap Horizons (Fabric 1.20.1) manifest + launcher via API.
 * Uso: node scripts/bootstrap-mcabyzum-horizons.mjs [baseUrl]
 */
const base = (process.argv[2] || 'https://mc.abyzum.com/api/backend').replace(/\/$/, '');
const serverId = 'mcabyzum';

async function main() {
  console.log(`Preparando ${serverId} en ${base}…`);
  const prepareUrl = `${base}/modrinth/deploy/${serverId}/launcher/prepare`;
  const res = await fetch(prepareUrl, { method: 'POST' });
  const body = await res.text();
  if (!res.ok) {
    console.error(`prepare failed (${res.status}):`, body);
    process.exit(1);
  }
  const data = JSON.parse(body);
  console.log(JSON.stringify(data, null, 2));
  console.log(`\nDescarga: ${base}/modrinth/deploy/${serverId}/launcher/download`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
