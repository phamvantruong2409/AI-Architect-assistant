<#
  build-swatches.ps1 — Dựng thư viện swatch vật liệu từ file ZIP color map An Cường.

  Đọc THẲNG từng ảnh trong zip (không giải nén toàn bộ ra ổ), cắt vuông giữa,
  thu nhỏ về <Size>px, lưu JPEG nhỏ vào <OutDir> và ghi index.json (tên + màu chủ đạo)
  để engine khớp swatch dùng sau. Ảnh gốc nặng KHÔNG bao giờ ghi ra đĩa.

  Cách dùng:
    powershell -ExecutionPolicy Bypass -File scripts/build-swatches.ps1 `
      -Zip "D:\...\01. MFC.zip" -OutDir "public\swatches\mfc" -Type mfc
#>
param(
  [Parameter(Mandatory = $true)][string]$Zip,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [Parameter(Mandatory = $true)][string]$Type,
  [int]$Size = 256,
  [int]$Quality = 78
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Zip)) { throw "Khong thay zip: $Zip" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# JPEG encoder + tham so chat luong
$jpegEnc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

$index = New-Object System.Collections.ArrayList
$zipArc = [System.IO.Compression.ZipFile]::OpenRead($Zip)
$imgEntries = $zipArc.Entries | Where-Object { $_.Name -match '\.(jpg|jpeg|png)$' -and $_.Length -gt 0 }
$total = $imgEntries.Count
$done = 0; $fail = 0
Write-Output "Bat dau: $total anh -> $OutDir (Size=$Size, Quality=$Quality)"

foreach ($e in $imgEntries) {
  $done++
  try {
    $stream = $e.Open()
    $src = [System.Drawing.Image]::FromStream($stream, $false, $false)

    # cat vuong giua
    $side = [Math]::Min($src.Width, $src.Height)
    $sx = [int](($src.Width - $side) / 2)
    $sy = [int](($src.Height - $side) / 2)
    $srcRect = New-Object System.Drawing.Rectangle($sx, $sy, $side, $side)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)), $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    # mau chu dao = trung binh, lay bang cach ve vao bitmap 1x1
    $one = New-Object System.Drawing.Bitmap(1, 1)
    $g1 = [System.Drawing.Graphics]::FromImage($one)
    $g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g1.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, 1, 1)), $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $px = $one.GetPixel(0, 0)
    $hex = '#{0:X2}{1:X2}{2:X2}' -f $px.R, $px.G, $px.B

    $base = [System.IO.Path]::GetFileNameWithoutExtension($e.Name)
    $outName = ($base -replace '[^\w\.\- ]', '').Trim() + '.jpg'
    $outPath = Join-Path $OutDir $outName
    $bmp.Save($outPath, $jpegEnc, $encParams)

    [void]$index.Add([ordered]@{ file = $outName; name = $base; color = $hex })

    $g1.Dispose(); $one.Dispose(); $g.Dispose(); $bmp.Dispose(); $src.Dispose(); $stream.Dispose()
  }
  catch {
    $fail++
    Write-Output ("  [LOI] {0}: {1}" -f $e.Name, $_.Exception.Message)
  }
  if ($done % 50 -eq 0) { Write-Output ("  ... {0}/{1}" -f $done, $total) }
}
$zipArc.Dispose()

# index.json cho engine khop swatch
$indexObj = [ordered]@{ type = $Type; size = $Size; count = $index.Count; items = $index }
$indexObj | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutDir 'index.json') -Encoding UTF8

Write-Output ("XONG: {0} anh OK, {1} loi -> {2}" -f ($total - $fail), $fail, $OutDir)
