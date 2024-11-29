try {
    Write-Output "Starting Docker push process with elevated privileges..."
    Start-Process -FilePath "powershell.exe" -ArgumentList "-Command docker-compose -f docker-compose.yml push" -Verb RunAs
    Write-Output "Docker push process initiated..."
    Start-Sleep -Seconds 30  # Give some time for the process to initiate
    $pushStatus = Start-Process -FilePath "docker" -ArgumentList "push collinlucke/baphomet-server:latest" -Wait -PassThru
    if ($pushStatus.ExitCode -eq 0) {
        Write-Output "Docker push completed successfully."
    } else {
        Write-Output "Docker push encountered an error."
        exit 1
    }
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
