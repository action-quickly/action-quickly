#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const os = require('os');

// --- Config ---
const CACHE_DIR = path.join(os.homedir(), '.action-quick', 'cache');
const GITHUB_REPO = 'action-quickly/action-quickly';

// --- Helpers ---

function pluginJsonPath() {
  const p = path.resolve(process.cwd(), 'plugin.json');
  if (!fs.existsSync(p)) {
    console.error('错误: 当前目录下未找到 plugin.json');
    console.error('请确保在插件项目的根目录下运行此命令');
    process.exit(1);
  }
  return p;
}

function parsePluginJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const manifest = JSON.parse(content);
    if (!manifest.id || !manifest.minHostVersion) {
      console.error('错误: plugin.json 缺少必填字段 id 或 minHostVersion');
      process.exit(1);
    }
    return manifest;
  } catch (e) {
    console.error('错误: plugin.json 解析失败:', e.message);
    process.exit(1);
  }
}

function getPlatform() {
  const map = {
    'win32': { platform: 'x86_64-pc-windows-msvc', ext: 'zip' },
    'darwin': { platform: 'x86_64-apple-darwin', ext: 'tar.gz' },
    'linux':  { platform: 'x86_64-unknown-linux-gnu', ext: 'tar.gz' },
  };
  return map[os.platform()];
}

function getBinaryName(ext) {
  return ext === 'zip' ? 'action-quick.exe' : 'action-quick';
}

function hostDir(version) {
  return path.join(CACHE_DIR, `host-v${version}`);
}

function isCached(version) {
  const plat = getPlatform();
  if (!plat) {
    console.error('错误: 不支持的操作系统:', os.platform());
    process.exit(1);
  }
  const binName = getBinaryName(plat.ext);
  return fs.existsSync(path.join(hostDir(version), binName));
}

function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}

function sameMajor(a, b) {
  return a.split('.')[0] === b.split('.')[0];
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'action-quick-debug' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('JSON 解析失败: ' + e.message)); }
        } else {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function findCompatibleRelease(minVersion) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`;
  const releases = await fetchJSON(url);
  if (!releases || !Array.isArray(releases)) return null;

  let best = null;
  for (const release of releases) {
    const tag = release.tag_name.replace(/^v/, '');
    if (sameMajor(tag, minVersion) && semverGte(tag, minVersion)) {
      if (!best || semverGte(tag, best)) {
        best = tag;
      }
    }
  }
  return best;
}

async function downloadRelease(version) {
  const plat = getPlatform();
  const dir = hostDir(version);
  fs.mkdirSync(dir, { recursive: true });

  const artifactName = `action-quick-${plat.platform}.${plat.ext}`;
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${artifactName}`;
  const dest = path.join(dir, artifactName);

  console.log(`下载 ActionQuick v${version}...`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`下载失败 (HTTP ${res.statusCode}): ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        if (plat.ext === 'zip') {
          console.log('  下载完成，解压中...');
          const { execSync } = require('child_process');
          try {
            execSync(`powershell -Command "Expand-Archive -Path '${dest}' -DestinationPath '${dir}' -Force"`);
          } catch {}
        } else {
          const { execSync } = require('child_process');
          execSync(`tar -xzf "${dest}" -C "${dir}"`);
        }
        try { fs.unlinkSync(dest); } catch {}
        resolve();
      });
    }).on('error', (err) => { file.close(); fs.unlinkSync(dest); reject(err); });
  });
}

// --- Main ---

async function main() {
  const manifest = parsePluginJson(pluginJsonPath());
  const plat = getPlatform();
  if (!plat) process.exit(1);

  const binName = getBinaryName(plat.ext);

  console.log(`查找兼容 v${manifest.minHostVersion} 的最新版本...`);
  const version = await findCompatibleRelease(manifest.minHostVersion);
  if (!version) {
    console.error(`错误: 未找到兼容 v${manifest.minHostVersion} 的主程序版本`);
    process.exit(1);
  }

  if (!isCached(version)) {
    await downloadRelease(version);
  }

  const binaryPath = path.join(hostDir(version), binName);
  if (!fs.existsSync(binaryPath)) {
    console.error(`错误: 主程序二进制未找到: ${binaryPath}`);
    process.exit(1);
  }

  console.log(`启动 ActionQuick v${version} (调试模式)...`);
  const child = spawn(binaryPath, ['--dev-plugin', process.cwd()], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error('错误:', e.message);
  process.exit(1);
});
