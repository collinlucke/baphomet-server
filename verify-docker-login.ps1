# Verify Docker Login Script
if (-not (docker info | Select-String 'Username: $env:DOCKER_USERNAME')) {
    Write-Output "Docker login verification failed."
    exit 1
} else {
    Write-Output "Docker login verified."
}
