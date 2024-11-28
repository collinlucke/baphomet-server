try {
    Write-Output "Starting Docker push process..."
    $pushOutput = docker-compose -f docker-compose.yml push 2>&1
    Write-Output "Docker push output:"
    Write-Output $pushOutput
    if ($LASTEXITCODE -eq 0) {
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
