#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const tls = require('tls');
const net = require('net');
const { spawn, execSync } = require('child_process');
const os = require('os');

const CACHE_DIR = path.join(os.homedir(), '.action-quick', 'cache');
const GITHUB_REPO = 'action-quickly/action-quickly';

// ── 代理支持 ──────────────────────────────────────────────────────────────

function getProxyUrl() {
  return process.env.HTTPS_PROXY || process.env.https_proxy ||
         process.env.HTTP_PROXY  || process.env.http_proxy  || null;
}

function createProxyAgent() {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return undefined;

  const u = new URL(proxyUrl);
  const proxyHost = u.hostname;
  const proxyPort = parseInt(u.port) || (u.protocol === 'https:' ? 443 : 80);
  const auth = u.username ? `${u.username}:${u.password || ''}` : null;

  // https.Agent 兼容：提供 createConnection 实现 CONNECT 隧道
  return new https.Agent({
    keepAlive: true,
    createConnection(options, cb) {
      const sock = net.connect({ host: proxyHost, port: proxyPort });
      sock.on('connect', () => {
        const targetHost = options.hostname || options.host || options.servername;
        const targetPort = options.port || 443;
        let req = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n`;
        if (auth) req += `Proxy-Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n`;
        req += '\r\n';
        sock.write(req);

        let buf = '';
        sock.once('data', (chunk) => {
          buf += chunk.toString();
          const match = buf.match(/^HTTP\/\d\.\d (\d{3})/);
          if (match && match[1] === '200') {
            // 去掉响应头剩余部分后升级为 TLS
            const headerEnd = buf.indexOf('\r\n\r\n');
            const tlsOpts = { socket: sock, servername: options.servername || targetHost, ALPNProtocols: options.ALPNProtocols };
            const tlsSocket = tls.connect(tlsOpts);
            tlsSocket.on('secureConnect', () => {
              // 如果响应头后有遗留数据，塞回 TLS 流
              if (headerEnd >= 0 && buf.length > headerEnd + 4) {
                tlsSocket.push(Buffer.from(buf.slice(headerEnd + 4)));
              }
              cb(null, tlsSocket);
            });
            tlsSocket.on('error', (e) => cb(e));
          } else {
            sock.destroy();
            cb(new Error(`代理 CONNECT 失败: ${buf.split('\r\n')[0] || match?.[0] || 'unknown'}`));
          }
        });
      });
      sock.on('error', (e) => cb(e));
    }
  });
}

// ── 共享的请求选项（含代理）─────────────────────────────────────────────────

function requestOptions(extraHeaders) {
  const opts = { headers: { 'User-Agent': 'action-quick-debug', ...(extraHeaders || {}) } };
  const agent = createProxyAgent();
  if (agent) opts.agent = agent;
  return opts;
}

// ── 工具函数 ──────────────────────────────────────────────────────────────

function assetPatterns() {
  switch (os.platform()) {
    case 'win32': return ['action-quick.exe', 'x64_en-US.msi'];
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
      return path.join(dir, assetName || 'action-quick.exe');
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
    https.get(url, requestOptions(), (res) => {
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
  const proxy = getProxyUrl();
  if (proxy) console.log(`  通过代理: ${proxy}`);

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doDownload = (url) => {
      https.get(url, requestOptions(), (res) => {
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

  // MSI 解压 (Windows 自带 msiexec，无需第三方工具)
  if (asset.name.endsWith('.msi')) {
    console.log('  解压 MSI...');
    execSync(`msiexec /a "${dest}" /qn TARGETDIR="${dir}"`, { stdio: 'inherit' });
    try { fs.unlinkSync(dest); } catch {}
    // 找到解压后的 exe（可能嵌套在子目录中）
    const files = fs.readdirSync(dir, { recursive: true });
    const exe = files.find(f => f.endsWith('.exe'));
    if (!exe) {
      console.error('错误: MSI 解压后未找到 exe');
      process.exit(1);
    }
    // 如果 exe 在子目录中，移到外层方便运行
    const exeSubDir = path.dirname(exe);
    if (exeSubDir !== '.') {
      const srcDir = path.join(dir, exeSubDir);
      const entries = fs.readdirSync(srcDir);
      for (const entry of entries) {
        fs.renameSync(path.join(srcDir, entry), path.join(dir, entry));
      }
      try { fs.rmdirSync(srcDir); } catch {}
    }
    fs.writeFileSync(cacheAssetPath(version), 'action-quick.exe');
    return;
  }

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

  const cachedName = fs.readFileSync(cacheAssetPath(version), 'utf-8').trim();
  const binPath = path.resolve(binaryPath(version, cachedName));
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
