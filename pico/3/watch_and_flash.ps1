$ErrorActionPreference = 'SilentlyContinue'
Write-Host 'Watcher active. Waiting for RPI-RP2 drive...'

for ($i = 0; $i -lt 3600; $i++) {
    $v = Get-Volume | Where-Object { $_.FileSystemLabel -eq 'RPI-RP2' -and $_.DriveLetter }
    if ($v) {
        $dest = "$($v.DriveLetter):\"
        Write-Host "Detected RPI-RP2 at $dest! Flashing babel_infinite_usb.uf2..."
        Start-Sleep -Milliseconds 500
        Copy-Item "c:\Users\geg\Documents\random\pico\3\babel_infinite_usb.uf2" "$dest\babel_infinite_usb.uf2" -Force
        Write-Host ">>> FLASHER SUCCESS: Infinite USB Firmware Written! <<<"
        [console]::beep(1000, 300)
        exit 0
    }
    Start-Sleep -Milliseconds 500
}
Write-Host "Watcher timeout."
