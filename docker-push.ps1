try {
    Write-Output "Starting Docker push process with elevated privileges..."
    
    # Start elevated PowerShell process and execute the docker push command
    $pushCommand = "docker-compose -f docker-compose.yml push"
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = "powershell.exe"
    $startInfo.Arguments = "-Command `"& { $pushCommand }`""
    $startInfo.Verb = "RunAs"
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo

    # Start the process
    $process.Start() | Out-Null

    # Capture output and errors
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()

    # Wait for the process to exit
    $process.WaitForExit()
    $exitCode = $process.ExitCode

    # Output the results
    Write-Output "Standard Output:"
    Write-Output $standardOutput
    Write-Output "Standard Error:"
    Write-Output $standardError

    if ($exitCode -eq 0) {
        Write-Output "Docker push completed successfully."
    } else {
        Write-Output "Docker push encountered an error with exit code $exitCode."
        exit 1
    }
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
