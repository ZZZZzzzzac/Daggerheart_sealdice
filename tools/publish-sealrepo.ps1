param([switch]$Check)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$origin = 'https://repo.sealdice.com'
$credential = Join-Path $root '.env.local'
$token = $env:SEALREPO_TOKEN
if (-not $token -and (Test-Path -LiteralPath $credential)) {
    $match = [regex]::Match([IO.File]::ReadAllText($credential), '(?m)^SEALREPO_TOKEN=([^\r\n]+)')
    $token = $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}
if (-not $token) { throw 'Set SEALREPO_TOKEN in ignored .env.local or the process environment.' }
$headers = @{ Authorization = 'Bearer ' + $token }
function Api($path, $method = 'GET', $body = $null) {
    $options = @{ Uri = $origin + '/api/v1' + $path; Method = $method; Headers = $headers; TimeoutSec = 30; MaximumRedirection = 0 }
    if ($null -ne $body) {
        $options.ContentType = 'application/json; charset=utf-8'
        $options.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
    }
    try { $response = Invoke-RestMethod @options }
    catch { throw ('SealRepo request failed: ' + $method + ' ' + $path + '; HTTP ' + [int]$_.Exception.Response.StatusCode + '. Check account permissions or server status.') }
    if ($response.success -eq $false) {
        $message = [string]$response.message
        throw ('SealRepo: ' + $message.Replace($token, '[redacted]'))
    }
    return $response.data
}

$manifest = [IO.File]::ReadAllText((Join-Path $root 'sealdice/packages/daggerheart/info.toml'))
$id = [regex]::Match($manifest, '(?m)^id = "([^"]+)"').Groups[1].Value
$version = [regex]::Match($manifest, '(?m)^version = "([0-9]+\.[0-9]+\.[0-9]+)"').Groups[1].Value
if ($id -ne 'zac/daggerheart' -or -not $version) { throw 'Expected zac/daggerheart and a semantic version in info.toml.' }
$namespace, $packageName = $id.Split('/')
$artifact = Join-Path $root ('sealdice/packages/daggerheart/dist/daggerheart-' + $version + '.sealpack')
if (-not (Test-Path -LiteralPath $artifact)) { throw 'Build the current sealpack first with npm test.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($artifact)
try {
    $reader = [IO.StreamReader]::new($zip.GetEntry('info.toml').Open())
    try { $packedManifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if ($packedManifest -ne $manifest) { throw 'Built manifest differs from source; rebuild before publishing.' }
} finally { $zip.Dispose() }
$hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
$null = Api '/user/me'
$namespaces = @(Api '/user/namespaces')
$repos = @(Api '/repo/my-repos')
if ($Check) {
    Write-Output ('Authenticated; package ' + $id + '@' + $version + '; namespaces: ' + ($namespaces | ConvertTo-Json -Compress -Depth 3))
    Write-Output ('Local SHA256 ' + $hash)
    exit 0
}

# These create only the namespace and package explicitly chosen for this project.
$namespaceExists = @($namespaces | Where-Object { $_ -eq $namespace -or $_.name -eq $namespace -or $_.namespace -eq $namespace }).Count -gt 0
if (-not $namespaceExists) {
    $null = Api '/user/namespaces' 'POST' @{ name = $namespace }
    Write-Output ('Created namespace ' + $namespace)
}
$packageExists = @($repos | Where-Object { $_.package_id -eq $id -or $_.package.package_id -eq $id -or ($_.namespace -eq $namespace -and $_.package -eq $packageName) }).Count -gt 0
if (-not $packageExists) {
    $null = Api '/repo/create' 'POST' @{ namespace = $namespace; package = $packageName }
    Write-Output ('Created package ' + $id)
}
$query = '?namespace=' + [Uri]::EscapeDataString($namespace) + '&package=' + [Uri]::EscapeDataString($packageName)
$info = Api ('/repo/manage/info' + $query)
if (@($info.versions | Where-Object { $_.version -eq $version }).Count -gt 0) {
    throw 'This version already exists. Verify its artifact before retrying; never overwrite or republish blindly.'
}
$upload = Api ('/repo/upload/' + [Uri]::EscapeDataString($namespace) + '/' + [Uri]::EscapeDataString($packageName)) 'POST'
$uploadUri = [Uri]$upload.upload_url
if ($uploadUri.Scheme -ne 'https' -or -not $upload.upload_id) { throw 'Invalid upload response.' }
try {
    # The presigned storage request carries only the package; never forward the CLI token.
    $null = Invoke-WebRequest -Uri $uploadUri -Method PUT -InFile $artifact -ContentType 'application/octet-stream' -UseBasicParsing -TimeoutSec 120 -MaximumRedirection 0
} catch { throw ('Package storage upload failed; HTTP ' + [int]$_.Exception.Response.StatusCode + '. Inspect workspace status before retrying.') }
$published = Api '/repo/upload-commit' 'POST' @{ namespace = $namespace; package = $packageName; upload_id = $upload.upload_id }
Write-Output ('Published ' + $id + '@' + $version)
Write-Output ('Local SHA256 ' + $hash)
try {
    $public = Invoke-RestMethod -Uri ($origin + '/api/v1/repo/ext/info' + $query + '&version=' + $version) -TimeoutSec 30 -MaximumRedirection 0
    if ($public.success -ne $true -or $public.data.package_id -ne $id -or $public.data.version -ne $version) { throw 'Published version is not publicly visible yet.' }
    $download = $origin + '/dice/api/store/packages/' + $namespace + '/' + $packageName + '/' + $version + '/' + [Uri]::EscapeDataString($packageName + '@' + $version + '.sealpack')
    $verification = Join-Path ([IO.Path]::GetTempPath()) ('sealrepo-verification-' + [Guid]::NewGuid().ToString('N') + '.sealpack')
    $null = Invoke-WebRequest -Uri $download -OutFile $verification -UseBasicParsing -TimeoutSec 60
    $downloadHash = (Get-FileHash -LiteralPath $verification -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($downloadHash -ne $hash) { throw 'Public download SHA256 differs from the local package.' }
    Write-Output 'Public download SHA256 verified.'
    if ($public.data.verified_at) { Write-Output 'Repository verification: verified.' }
    else { Write-Output 'Repository verification: not yet marked verified.' }
} catch {
    Write-Warning 'The commit succeeded, but public download verification failed. Inspect the workspace and artifact before retrying.'
    exit 1
}
Write-Output ('https://repo.sealdice.com/packages?namespace=' + $namespace + '&package=' + $packageName)
