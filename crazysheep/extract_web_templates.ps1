$targetDir = "$env:APPDATA\Godot\export_templates\4.4.stable"
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

Write-Host "Extracting web export templates from templates.tpz..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("templates.tpz")

foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "templates/web*" -or $entry.FullName -eq "templates/version.txt") {
        $fileName = [System.IO.Path]::GetFileName($entry.FullName)
        if ($fileName) {
            $destPath = Join-Path $targetDir $fileName
            Write-Host "Extracting $fileName to $destPath..."
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
        }
    }
}
$zip.Dispose()
Write-Host "Web templates extracted successfully!"
