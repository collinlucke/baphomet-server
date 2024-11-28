try {
    docker-compose -f docker-compose.yml push
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
Write-Output "Docker push completed successfully."
