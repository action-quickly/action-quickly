# 安装示例插件到 ActionQuick
# 用法: npm run install:hello

$pluginDir = "$PSScriptRoot\..\examples\plugins\hello"
$tempZip = "$env:TEMP\hello-plugin.zip"

# 打包为 zip
if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
Compress-Archive -Path "$pluginDir\*" -DestinationPath $tempZip -Force

Write-Host "插件已打包到: $tempZip"
Write-Host "请在 ActionQuick 中使用以下路径安装:"
Write-Host "  $tempZip"
Write-Host ""
Write-Host "或在开发者模式下，直接将插件目录复制到 ~/.action-quick/plugins/hello/"
