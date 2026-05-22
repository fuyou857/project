# Windows 等价于 scripts/deploy-site.sh（PowerShell，无需 bash）。
# 在项目根目录执行：
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-site.ps1
# 若网站根已指向 dist，仅构建不复制到项目根：
#   $env:CIOND_DEPLOY_DIST_ONLY = "1"; powershell -ExecutionPolicy Bypass -File .\scripts\deploy-site.ps1

$ErrorActionPreference = "Stop"
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $ROOT

if (-not $env:NODE_OPTIONS) {
  $env:NODE_OPTIONS = "--max-old-space-size=3072"
}

Write-Host "[deploy-site.ps1] 构建中… ($ROOT)"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[deploy-site.ps1] 构建完成，静态文件已在: $ROOT\dist"

if ($env:CIOND_DEPLOY_DIST_ONLY -eq "1") {
  Write-Host "[deploy-site.ps1] CIOND_DEPLOY_DIST_ONLY=1：不镜像到项目根（请确认 Nginx root 为: $ROOT\dist）"
} else {
  Write-Host "[deploy-site.ps1] 同步 dist → 项目根（*.js / *.css / index.html 等）"
  $dist = Join-Path $ROOT "dist"
  foreach ($name in @("index.html", "manifest.json", "sw.js")) {
    $src = Join-Path $dist $name
    if (Test-Path -LiteralPath $src) {
      Copy-Item -LiteralPath $src -Destination $ROOT -Force
    }
  }
  Get-ChildItem -Path $dist -Filter "*.js" -File -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $ROOT -Force
  }
  Get-ChildItem -Path $dist -Filter "*.css" -File -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $ROOT -Force
  }
  Write-Host "[deploy-site.ps1] 已复制 dist 内入口与 chunk 至: $ROOT"
}

& node (Join-Path $ROOT "scripts\prune-stale-root-bundles.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[deploy-site.ps1] 完成。"
