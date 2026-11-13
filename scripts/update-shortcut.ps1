param([Parameter(Mandatory = $true)][string]$Version)
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^[1-9][0-9]*\.[0-9]$') { throw 'Versao invalida.' }
$projectPath = Split-Path -Parent $PSScriptRoot
$releasePath = Join-Path $projectPath 'release'
$artifactPath = Join-Path $releasePath "Sellora-$Version-Windows-x64.exe"
if (-not (Test-Path -LiteralPath $artifactPath)) { throw "Executavel ausente: $artifactPath" }
$shortcutShell = New-Object -ComObject WScript.Shell
$desktopPath = $shortcutShell.SpecialFolders.Item('Desktop')
if (-not $desktopPath) { throw 'Area de trabalho indisponivel.' }
$appFolder = Join-Path $desktopPath 'Sellora'
New-Item -ItemType Directory -Path $appFolder -Force | Out-Null
$targetPath = Join-Path $appFolder "Sellora $Version.exe"
Copy-Item -LiteralPath $artifactPath -Destination $targetPath
$shortcutPath = Join-Path $desktopPath "Sellora $Version.lnk"
$desktopPaths = @($desktopPath, [Environment]::GetFolderPath('CommonDesktopDirectory')) | Where-Object { $_ }
$existing = foreach ($directory in $desktopPaths) {
    Get-ChildItem -LiteralPath $directory -Filter '*Sellora*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
        $link = $shortcutShell.CreateShortcut($_.FullName)
        if ($link.TargetPath -and ([IO.Path]::GetDirectoryName($link.TargetPath) -eq $releasePath -or [IO.Path]::GetDirectoryName($link.TargetPath) -eq $appFolder) -and [IO.Path]::GetFileName($link.TargetPath) -like 'Sellora*.exe') { $_ }
    }
}
$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $appFolder
$shortcut.Arguments = ''
$shortcut.Description = "Sellora $Version"
$shortcut.IconLocation = "$targetPath,0"
$shortcut.Save()
foreach ($oldShortcut in $existing) {
    if ($oldShortcut.FullName -ne $shortcutPath) { Remove-Item -LiteralPath $oldShortcut.FullName }
}
$verified = $shortcutShell.CreateShortcut($shortcutPath)
if ($verified.TargetPath -ne $targetPath) { throw 'O atalho nao aponta para a versao validada.' }
Write-Output "Atalho atualizado: $shortcutPath"
