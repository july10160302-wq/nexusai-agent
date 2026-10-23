param([int]$Port = 17100, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$webRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\dist'))
if (!(Test-Path -LiteralPath (Join-Path $webRoot 'index.html'))) {
  throw 'Missing dist/index.html. Extract the complete browser ZIP first, or run npm run build in the source project.'
}
$listener = New-Object System.Net.HttpListener
$webUrl = "http://localhost:$Port/"
$listener.Prefixes.Add($webUrl)
try { $listener.Start() } catch { throw "Cannot start $webUrl Close any other NexusAI browser launcher, or choose a different -Port. $($_.Exception.Message)" }
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.ico'='image/x-icon'; '.woff2'='font/woff2' }
Write-Host "NexusAI: $webUrl"
Write-Host 'Keep this window open while using the browser. Close it to stop.'
if (!$NoBrowser) { Start-Process $webUrl }
try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    try {
      if ($context.Request.HttpMethod -notin @('GET', 'HEAD')) { $response.StatusCode = 405; continue }
      $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
      if ($requestPath -eq '/') { $requestPath = '/index.html' }
      $webFile = [IO.Path]::GetFullPath((Join-Path $webRoot $requestPath.TrimStart('/')))
      if (!$webFile.StartsWith($webRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { $response.StatusCode = 403; continue }
      if (!(Test-Path -LiteralPath $webFile -PathType Leaf)) { $response.StatusCode = 404; continue }
      $checkPath = $webFile
      while ($checkPath -ne $webRoot) {
        if ((Get-Item -LiteralPath $checkPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked paths are not served.' }
        $checkPath = [IO.Path]::GetDirectoryName($checkPath)
      }
      $bytes = [IO.File]::ReadAllBytes($webFile)
      $extension = [IO.Path]::GetExtension($webFile)
      $response.ContentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }
      $response.Headers['Cache-Control'] = 'no-cache'
      $response.Headers['X-Content-Type-Options'] = 'nosniff'
      $response.ContentLength64 = $bytes.Length
      if ($context.Request.HttpMethod -eq 'GET') { $response.OutputStream.Write($bytes, 0, $bytes.Length) }
    } catch { $response.StatusCode = 404 } finally { $response.Close() }
  }
} finally { $listener.Close() }
