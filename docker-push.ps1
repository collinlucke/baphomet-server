if (Test-Path "./docker-push.ps1") {
    Write-Output "Found docker-push.ps1 script, executing it..."
    ./docker-push.ps1
} else {
    Write-Output "docker-push.ps1 script not found."
    exit 1
}

try {
    Write-Output "Starting Docker push process..."
    docker-compose -f docker-compose.yml push
    Write-Output "Docker push completed successfully."
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
