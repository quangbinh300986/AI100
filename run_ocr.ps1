[Void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime")
$OcrEngineType = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime]
$LanguageType = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]

# 检查是否支持中文(简体)
$lang = New-Object $LanguageType("zh-Hans")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)

if ($null -eq $engine) {
    Write-Host "Failed to create OCR engine for zh-Hans, falling back to default"
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}

function Invoke-Ocr($imagePath) {
    # 读取图片为Windows Runtime Stream
    $file = [Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath).GetResults()
    $stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetResults()
    
    # 载入解码器
    $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetResults()
    $bitmap = $decoder.GetSoftwareBitmapAsync().GetResults()
    
    # 执行OCR
    $result = $engine.RecognizeAsync($bitmap).GetResults()
    
    Write-Host "--- OCR Result for $($file.Name) ---"
    foreach ($line in $result.Lines) {
        Write-Host $line.Text
    }
}

$files = Get-ChildItem -Path "C:\APP\AI100" -Filter *.png
foreach ($f in $files) {
    if ($f.Name -like "*2026*") {
        Write-Host "Found file: $($f.FullName)"
        try {
            Invoke-Ocr($f.FullName)
        } catch {
            Write-Host "Error processing $($f.Name): $_"
        }
    }
}
