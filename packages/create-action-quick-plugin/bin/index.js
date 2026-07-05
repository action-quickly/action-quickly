#!/usr/bin/env node

import { mkdir, readFile, writeFile, readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

const FRAMEWORKS = ['vanilla', 'react'];

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function placeholderReplacer(name, pluginId) {
  return (content) =>
    content
      .replace(/PLUGIN_NAME/g, name)
      .replace(/PLUGIN_ID/g, pluginId);
}

async function copyTemplate(srcDir, destDir, transformContent) {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyTemplate(srcPath, destPath, transformContent);
    } else {
      const content = await readFile(srcPath, 'utf-8');
      await writeFile(destPath, transformContent(content));
    }
  }
}

async function main() {
  console.log('\n🚀 ActionQuick Plugin Scaffolder\n');

  let name = process.argv[2];
  if (!name) {
    name = await ask('插件名称 (如 my-plugin): ');
    if (!name) {
      console.error('插件名称不能为空');
      process.exit(1);
    }
  }

  const pluginId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  let framework = process.argv[3];
  if (!framework || !FRAMEWORKS.includes(framework)) {
    console.log('可选框架: ' + FRAMEWORKS.join(', '));
    framework = await ask('选择框架 (默认 vanilla): ');
    if (!framework || !FRAMEWORKS.includes(framework)) {
      framework = 'vanilla';
    }
  }

  const targetDir = resolve(process.cwd(), name);
  if (existsSync(targetDir)) {
    console.error(`目录已存在: ${targetDir}`);
    process.exit(1);
  }

  console.log(`\n创建插件: ${pluginId} (${framework})`);
  console.log(`目录: ${targetDir}\n`);

  const templateDir = join(TEMPLATES_DIR, framework);
  if (!existsSync(templateDir)) {
    console.error(`错误: 未找到框架模板 ${framework}`);
    process.exit(1);
  }

  await mkdir(targetDir, { recursive: true });
  const transform = placeholderReplacer(name, pluginId);
  await copyTemplate(templateDir, targetDir, transform);

  console.log('  ✓ 所有文件已创建');

  if (framework === 'react') {
    console.log('\n📦 下一步:');
    console.log(`  cd ${name}`);
    console.log('  npm install');
    console.log('  npm link @action-quick/sdk');
    console.log('  npm run build');
    console.log('  aq-debug');
  } else {
    console.log('\n📦 下一步:');
    console.log(`  cd ${name}`);
    console.log('  aq-debug');
  }
}

main().catch((e) => {
  console.error('错误:', e.message);
  process.exit(1);
});
