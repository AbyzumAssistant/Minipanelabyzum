#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function resolveBundleRoot() {
  if (process.pkg) {
    return path.dirname(process.execPath);
  }
  return __dirname;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirContents(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return 0;
  ensureDir(targetDir);
  let count = 0;
  for (const entry of fs.readdirSync(sourceDir)) {
    const from = path.join(sourceDir, entry);
    const to = path.join(targetDir, entry);
    if (fs.statSync(from).isDirectory()) continue;
    fs.copyFileSync(from, to);
    count += 1;
  }
  return count;
}

function showWindowsDialog(title, message) {
  const escaped = message.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${escaped}','${title.replace(/'/g, "''")}','OK','Information')"`,
    { stdio: 'ignore' },
  );
}

function copyToClipboard(text) {
  const escaped = text.replace(/'/g, "''");
  execSync(`powershell -NoProfile -Command "Set-Clipboard -Value '${escaped}'"`, { stdio: 'ignore' });
}

function openExplorer(dir) {
  execSync(`explorer "${dir.replace(/"/g, '""')}"`, { stdio: 'ignore' });
}

function main() {
  const root = resolveBundleRoot();
  const configPath = path.join(root, 'config.json');
  const manifestPath = path.join(root, 'manifest.json');

  if (!fs.existsSync(configPath) || !fs.existsSync(manifestPath)) {
    console.error('Faltan config.json o manifest.json junto al launcher.');
    process.exit(1);
  }

  const config = readJson(configPath);
  const manifest = readJson(manifestPath);
  const serverId = config.serverId || manifest.serverId || 'mcabyzum';
  const server = manifest.server || config.server;

  if (!server?.host || !server?.port) {
    console.error('El manifest no incluye host/puerto del servidor.');
    process.exit(1);
  }

  const appRoot = path.join(os.homedir(), 'AppData', 'Roaming', 'MCABYZUM', serverId);
  const modsDir = path.join(appRoot, 'mods');
  const copied = copyDirContents(path.join(root, 'mods'), modsDir);

  const resourceSrc = path.join(root, 'resourcepack');
  if (fs.existsSync(resourceSrc)) {
    copyDirContents(resourceSrc, path.join(appRoot, 'resourcepacks'));
  }

  fs.writeFileSync(
    path.join(appRoot, 'profile.json'),
    JSON.stringify(
      {
        serverId,
        server,
        gameVersion: manifest.gameVersion,
        loader: manifest.loader,
        forgeBuild: manifest.forgeBuild,
        launcherRevision: manifest.launcherRevision,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  const address = `${server.host}:${server.port}`;
  const lines = [
    `Mods instalados: ${copied}`,
    `Carpeta: ${modsDir}`,
    '',
    `IP copiada: ${address}`,
    '',
    'Abre Minecraft → Multijugador → Directo',
    `Pega: ${address}`,
  ];

  if (process.platform === 'win32') {
    try {
      copyToClipboard(address);
    } catch {
      /* ignore */
    }
    try {
      showWindowsDialog('MCABYZUM Launcher', lines.join('\\n'));
    } catch {
      console.log(lines.join('\n'));
    }
    try {
      openExplorer(modsDir);
    } catch {
      /* ignore */
    }
  } else {
    console.log(lines.join('\n'));
  }
}

main();
