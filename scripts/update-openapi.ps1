param(
    [string]$BaseUrl
)

$base = $BaseUrl
if (-not $base) {
    $base = $env:API_BASE_URL
}

if (-not $base) {
    Write-Error "BASE_URL is required. Pass -BaseUrl or set API_BASE_URL."
    exit 1
}

$swaggerUrl = $base.TrimEnd('/')
if ($swaggerUrl -notmatch '\\/.+\\.json$') {
    $swaggerUrl = "$swaggerUrl/swagger/v1/swagger.json"
}

$outputPath = Join-Path $PSScriptRoot '..' 'docs' 'openapi.json'

Write-Host "Fetching OpenAPI from $swaggerUrl"

try {
    $response = Invoke-WebRequest -Uri $swaggerUrl -UseBasicParsing
    $json = $response.Content
    if (-not $json) {
        throw "Empty response from $swaggerUrl"
    }

    $json | Set-Content -Path $outputPath
    Write-Host "Saved OpenAPI snapshot to $outputPath"
}
catch {
    Write-Error $_
    exit 1
}
