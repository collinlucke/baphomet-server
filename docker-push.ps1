try {
    Write-Output "Starting Docker push process..."
    $pushOutput = docker-compose -f docker-compose.yml push 2>&1
    Write-Output "Docker push output:"
    Write-Output $pushOutput
    Write-Output "Docker push completed successfully."
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
