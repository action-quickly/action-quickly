#!/usr/bin/env node

import { mkdir, writeFile, copyFile, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FRAMEWORKS = ["vanilla", "vue", "react", "svelte"];

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n🚀 ActionQuick Plugin Scaffolder\n");

  let name = process.argv[2];
  if (!name) {
    name = await ask("插件名称 (如 my-plugin): ");
    if (!name) {
      console.error("插件名称不能为空");
      process.exit(1);
    }
  }

  const pluginId = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  let framework = process.argv[3];
  if (!framework || !FRAMEWORKS.includes(framework)) {
    console.log("可选框架: " + FRAMEWORKS.join(", "));
    framework = await ask("选择框架 (默认 vanilla): ");
    if (!framework || !FRAMEWORKS.includes(framework)) {
      framework = "vanilla";
    }
  }

  const targetDir = resolve(process.cwd(), name);
  if (existsSync(targetDir)) {
    console.error(`目录已存在: ${targetDir}`);
    process.exit(1);
  }

  console.log(`\n创建插件: ${pluginId} (${framework})`);
  console.log(`目录: ${targetDir}\n`);

  // 创建目录
  mkdir(targetDir, { recursive: true }, () => {});

  // plugin.json
  const pluginJson = {
    id: pluginId,
    name: pluginId,
    version: "1.0.0",
    author: "",
    description: "A new ActionQuick plugin",
    icon: "icon.png",
    main: "index.html",
    keywords: [pluginId],
    permissions: ["clipboard"],
    minHostVersion: "0.1.0",
  };

  await writeFile(join(targetDir, "plugin.json"), JSON.stringify(pluginJson, null, 2));
  console.log("  ✓ plugin.json");

  // index.html (所有框架统一用 vanilla 模板，实际项目可自行替换)
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pluginId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; background: rgba(30,30,35,0.95); color: #e8e8e8; padding: 24px; height: 100vh; display: flex; flex-direction: column; gap: 16px; }
    h1 { font-size: 20px; }
    .params { background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #999; }
    .params code { color: #4a9eff; }
    button { background: #4a9eff; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-family: inherit; }
    button:hover { background: #3a8ee5; }
    .result { background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; font-size: 13px; min-height: 40px; }
  </style>
</head>
<body>
  <h1>${pluginId}</h1>
  <div class="params" id="params">加载参数中...</div>
  <button id="actionBtn">执行操作</button>
  <div class="result" id="result">结果将显示在这里</div>

  <script>
    // ActionQuick 插件通信桥接
    var ipcId = 0, pending = {};
    function invoke(cmd, args) {
      return new Promise(function(resolve, reject) {
        var id = ++ipcId; pending[id] = { resolve: resolve, reject: reject };
        window.parent.postMessage({ source: "action-quick-plugin", id: id, cmd: cmd, args: args || {} }, "*");
      });
    }
    window.addEventListener("message", function(e) {
      var d = e.data;
      if (!d || d.source !== "action-quick-host") return;
      if (d.type === "aq-init-bridge" && d.script) { try { eval(d.script); } catch(x){} return; }
      if (d.type === "plugin-params") {
        var p = d.params;
        document.getElementById("params").innerHTML = "query: <code>" + (p.query||"无") + "</code><br>contextText: <code>" + (p.contextText||"无") + "</code>";
      }
      if (d.id && pending[d.id]) { var c = pending[d.id]; delete pending[d.id]; d.error ? c.reject(d.error) : c.resolve(d.result); }
    });

    document.getElementById("actionBtn").addEventListener("click", function() {
      invoke("aq_clipboard_write", { text: "Hello from ${pluginId}!" })
        .then(function() { document.getElementById("result").textContent = "已写入剪贴板"; })
        .catch(function(e) { document.getElementById("result").textContent = "错误: " + e; });
    });
  </script>
</body>
</html>`;

  await writeFile(join(targetDir, "index.html"), html);
  console.log("  ✓ index.html");

  // README.md
  const readme = `# ${pluginId}

ActionQuick 插件: ${pluginId}

## 开发

\`\`\`bash
# 在 ActionQuick 中通过开发者模式加载此目录
# 或直接将目录路径输入到插件管理界面的"从目录安装"
\`\`\`

## 权限

- clipboard: 剪贴板读写
`;

  await writeFile(join(targetDir, "README.md"), readme);
  console.log("  ✓ README.md");

  console.log("\n✅ 插件创建成功！");
  console.log(`\n下一步: 在 ActionQuick 插件管理中输入路径安装: ${targetDir}`);
}

main();
