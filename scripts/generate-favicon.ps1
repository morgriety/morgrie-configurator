param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

# Preserve the official alpha silhouette; apply the reviewed 135-degree gradient.
# Full-width contain is already the largest uncropped, aspect-preserving fit.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sourcePath = Join-Path $ProjectRoot 'resources\branding\morgrie-favicon-source.png'
$expectedHash = '156364aaf78a044b84fe8423345fed1a1a346fb8340eba4d1058ab78d6e99197'
if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw 'Official favicon source differs from the reviewed PNG; inspect the replacement before regenerating.'
}
$outputRoot = Join-Path $ProjectRoot 'public'
$sourceImage = [System.Drawing.Bitmap]::new($sourcePath)
$frames = [System.Collections.Generic.List[byte[]]]::new()
$sizes = @(16, 32, 48)
try {
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
        $stream = [System.IO.MemoryStream]::new()
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $scale = [Math]::Min($size / [double]$sourceImage.Width, $size / [double]$sourceImage.Height)
            $width = [single]($sourceImage.Width * $scale)
            $height = [single]($sourceImage.Height * $scale)
            $left = [single](($size - $width) / 2)
            $top = [single](($size - $height) / 2)
            $points = [System.Drawing.PointF[]]@(
                [System.Drawing.PointF]::new($left, $top),
                [System.Drawing.PointF]::new($left + $width, $top),
                [System.Drawing.PointF]::new($left, $top + $height)
            )
            $sourceRect = [System.Drawing.RectangleF]::new(0, 0, $sourceImage.Width, $sourceImage.Height)
            $graphics.DrawImage($sourceImage, $points, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
            # CSS 135deg = top-left to bottom-right. Project onto x+y across
            # the fitted logo rectangle; interpolate the three approved stops.
            # Work after resampling so every alpha byte remains unchanged.
            for ($y = 0; $y -lt $size; $y++) {
                for ($x = 0; $x -lt $size; $x++) {
                    $pixel = $bitmap.GetPixel($x, $y)
                    if ($pixel.A -eq 0) { continue }
                    $t = [Math]::Clamp((($x + 0.5 - $left) + ($y + 0.5 - $top)) / ($width + $height), 0.0, 1.0)
                    if ($t -le 0.5) {
                        $start = @(22, 217, 192)  # #16D9C0
                        $end = @(0, 201, 174)     # #00C9AE
                        $fraction = $t * 2
                    }
                    else {
                        $start = @(0, 201, 174)   # #00C9AE
                        $end = @(0, 184, 160)     # #00B8A0
                        $fraction = ($t - 0.5) * 2
                    }
                    $red = [int][Math]::Round($start[0] + ($end[0] - $start[0]) * $fraction)
                    $green = [int][Math]::Round($start[1] + ($end[1] - $start[1]) * $fraction)
                    $blue = [int][Math]::Round($start[2] + ($end[2] - $start[2]) * $fraction)
                    $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, $red, $green, $blue))
                }
            }

            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            $bytes = $stream.ToArray()
            $frames.Add($bytes)
            if ($size -le 32) {
                [System.IO.File]::WriteAllBytes((Join-Path $outputRoot "favicon-${size}x${size}.png"), $bytes)
            }
        }
        finally {
            $stream.Dispose()
            $attributes.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
    # Standard ICO directory with 16/32/48px PNG-compressed RGBA frames.
    $ico = [System.IO.MemoryStream]::new()
    $writer = [System.IO.BinaryWriter]::new($ico)
    try {
        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $writer.Write([byte]$sizes[$i]); $writer.Write([byte]$sizes[$i])
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
            $offset += $frames[$i].Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
        $writer.Flush()
        [System.IO.File]::WriteAllBytes((Join-Path $outputRoot 'favicon.ico'), $ico.ToArray())
    }
    finally { $writer.Dispose(); $ico.Dispose() }
}
finally { $sourceImage.Dispose() }
Write-Output 'Generated local MORGRIE favicon PNGs (16, 32) and ICO (16, 32, 48); 135-degree teal gradient; maximum uncropped proportions and alpha retained.'
