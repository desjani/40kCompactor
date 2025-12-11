$source = 'C:\Git\40kCompactor\40kCompactor'
$dest = '\\METRON\appdata\40kCompactor'
$exclude = @('.git', '.vscode', 'node_modules', 'test', 'samples', 'tmp')

Write-Host "Deploying to $dest..."
robocopy $source $dest /MIR /XD $exclude /R:1 /W:1

# Robocopy exit codes 0-7 are success (0=No Change, 1=Copy Successful, etc.)
if ($LASTEXITCODE -le 7) { 
    Write-Host "Deployment Complete (Exit Code: $LASTEXITCODE)." -ForegroundColor Green 
    exit 0
} else { 
    Write-Host "Deployment Failed with code $LASTEXITCODE" -ForegroundColor Red 
    exit $LASTEXITCODE
}
