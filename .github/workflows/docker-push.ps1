Start-Process -FilePath "powershell.exe" -ArgumentList "-Command docker-compose -f docker-compose.yml push" -Verb RunAs -Wait -PassThru | ForEach-Object{
    $_.StandardOutput.ReadToEnd() | Write-Output
    $_.StandardError.ReadToEnd() | Write-Output
}
