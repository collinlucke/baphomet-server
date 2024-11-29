try {
    Write-Output "Starting Docker push process with elevated privileges..."
    Start-Process -FilePath "powershell.exe" -ArgumentList "-Command docker-compose -f docker-compose.yml push" -Verb RunAs
    Write-Output "Docker push process initiated..."
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
