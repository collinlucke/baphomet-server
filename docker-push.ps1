try {
    Write-Output "Starting Docker push process..."
    docker-compose -f docker-compose.yml push | Write-Output
    Write-Output "Docker push completed successfully."
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
