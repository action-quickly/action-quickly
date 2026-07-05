#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const os = require('os');

const CACHE_DIR = path.join(os.homedir(), '.action-quick', 'cache');
const GITHUB_REPO = 'action-quickly/action-quickly';

function assetPatterns() {
  switch (os.platform()) {
    case 'win32': return ['action-quick-x86_64-pc-windows-msvc.exe'];
    case 'darwin': return ['action-quick-x86_64-apple-darwin', 'action-quick-aarch64-apple-darwin'];
    case 'linux': return ['.deb', '.AppImage'];
    default: return [];
  }
}

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

function hostDir(version) {
  return path.join(CACHE_DIR, `host-v${version}`);
}

function cacheAssetPath(version) {
  return path.join(hostDir(version), '.asset-name');
}

function isCached(version) {
  const marker = cacheAssetPath(version);
  if (!fs.existsSync(marker)) return false;
  const assetName = fs.readFileSync(marker, 'utf-8').trim();
  const binPath = binaryPath(version, assetName);
  return fs.existsSync(binPath);
}

function binaryPath(version, assetName) {
  const dir = hostDir(version);
  switch (os.platform()) {
    case 'win32':
      return path.join(dir, assetName || 'action-quick-x86_64-pc-windows-msvc.exe');
    case 'darwin':
      return path.join(dir, assetName || 'action-quick-x86_64-apple-darwin');
    case 'linux':
      return path.join(dir, assetName || 'action-quick');
    default:
      return null;
  }
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
        best = release;
      }
    }
  }
  return best;
}

function findAsset(release) {
  const patterns = assetPatterns();
  if (!release.assets) return null;
  for (const pattern of patterns) {
    const asset = release.assets.find(a => a.name.includes(pattern));
    if (asset) return asset;
  }
  return null;
}

async function downloadAndInstall(release) {
  const version = release.tag_name.replace(/^v/, '');
  const asset = findAsset(release);
  if (!asset) {
    console.error(`错误: 未能找到当前平台 (${os.platform()}) 的兼容制品`);
    process.exit(1);
  }

  const dir = hostDir(version);
  fs.mkdirSync(dir, { recursive: true });

  const dest = path.join(dir, asset.name);

  console.log(`下载 ActionQuick v${version}...`);

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doDownload = (url) => {
      https.get(url, { headers: { 'User-Agent': 'action-quick-debug' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          doDownload(res.headers.location);
          return;
        }
        if (res.statusCode >= 300) {
          file.close();
          try { fs.unlinkSync(dest); } catch {}
          reject(new Error(`下载失败 (HTTP ${res.statusCode})`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        reject(err);
      });
    };
    doDownload(asset.browser_download_url);
  });

  // 设置可执行权限 (macOS/Linux)
  if (os.platform() !== 'win32') {
    try { fs.chmodSync(dest, 0o755); } catch {}
  }

  fs.writeFileSync(cacheAssetPath(version), asset.name);
}

async function main() {
  const manifest = parsePluginJson(pluginJsonPath());
  const patterns = assetPatterns();
  if (patterns.length === 0) {
    console.error('错误: 不支持的操作系统:', os.platform());
    process.exit(1);
  }

  console.log(`查找兼容 v${manifest.minHostVersion} 的最新版本...`);
  const release = await findCompatibleRelease(manifest.minHostVersion);
  if (!release) {
    console.error(`错误: 未找到兼容 v${manifest.minHostVersion} 的主程序版本`);
    process.exit(1);
  }

  const version = release.tag_name.replace(/^v/, '');
  const asset = findAsset(release);

  if (!isCached(version)) {
    await downloadAndInstall(release);
  }

  const binPath = path.resolve(binaryPath(version, asset ? asset.name : null));
  if (!fs.existsSync(binPath)) {
    console.error(`错误: 主程序二进制未找到: ${binPath}`);
    process.exit(1);
  }

  console.log(`启动 ActionQuick v${version} (调试模式)...`);
  const child = spawn(binPath, ['--dev-plugin', process.cwd()], {
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
