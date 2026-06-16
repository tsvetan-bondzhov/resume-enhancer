# install-hooks.ps1
# Run once after cloning to register the shared Git hooks in .githooks/.
# Usage: .\scripts\install-hooks.ps1

$RepoRoot = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) {
    Write-Error "Must be run from inside the repository."
    exit 1
}

git config core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set core.hooksPath."
    exit 1
}

Write-Host "Git hooks registered. '$RepoRoot\.githooks' is now the active hooks directory."
Write-Host "Active hooks:"
Get-ChildItem "$RepoRoot\.githooks" | Where-Object { -not $_.Name.EndsWith(".sample") } | ForEach-Object {
    Write-Host "  - $($_.Name)"
}
