param (
    [string]$VideoPath = ""
)

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$window = New-Object System.Windows.Window
$window.Title = "Fullscreen Video Player"
$window.WindowStyle = [System.Windows.WindowStyle]::None
$window.WindowState = [System.Windows.WindowState]::Maximized
$window.Topmost = $true
$window.Background = [System.Windows.Media.Brushes]::Black
$window.Cursor = [System.Windows.Input.Cursors]::None

$grid = New-Object System.Windows.Controls.Grid
$grid.Background = [System.Windows.Media.Brushes]::Black

$fullPath = [System.IO.Path]::GetFullPath($VideoPath)
if (-not [System.IO.File]::Exists($fullPath)) {
    exit 1
}

$media = New-Object System.Windows.Controls.MediaElement
$media.LoadedBehavior = [System.Windows.Controls.MediaState]::Play
$media.UnloadedBehavior = [System.Windows.Controls.MediaState]::Manual
$media.Stretch = [System.Windows.Media.Stretch]::Uniform
$media.Source = [System.Uri]::new($fullPath)

# Auto-close on video completion
$media.Add_MediaEnded({
    $window.Close()
})

# Block Escape, mouse clicks; only 'Z' or 'z' dismisses
$window.Add_KeyDown({
    param($sender, $e)
    if ($e.Key -eq [System.Windows.Input.Key]::Z) {
        $window.Close()
    } else {
        $e.Handled = $true
    }
})

$window.Add_MouseDown({
    param($sender, $e)
    $e.Handled = $true
})

$grid.Children.Add($media) | Out-Null
$window.Content = $grid

$window.Add_Loaded({
    $media.Play()
})

$app = New-Object System.Windows.Application
$app.Run($window) | Out-Null
