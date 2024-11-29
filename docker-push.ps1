try {
    Write-Output "Starting Docker push process with elevated privileges..."
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "powershell.exe"
    $processInfo.Arguments = "-Command docker-compose -f docker-compose.yml push"
    $processInfo.Verb = "RunAs"
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    
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
        Write-Output "Docker push encountered an error."
        exit 1
    }
} catch {
    Write-Output "Docker push failed."
    Write-Output $_.Exception.Message
    exit 1
}
