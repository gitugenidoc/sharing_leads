#!/usr/bin/env pwsh
# Helper script to run PostgreSQL commands
# Usage: .\db-sql.ps1 -ScriptPath "path/to/script.sql" -Password "your_password"

param(
    [string]$ScriptPath,
    [string]$Database = "lead_db",
    [string]$User = "postgres",
    [string]$Host = "localhost",
    [string]$Port = "5432",
    [string]$Password
)

$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

if (-not (Test-Path $psqlPath)) {
    Write-Host "Error: PostgreSQL not found at $psqlPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ScriptPath)) {
    Write-Host "Error: Script file not found: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Executing SQL script: $ScriptPath" -ForegroundColor Green
Write-Host "Database: $Database, User: $User, Host: $Host" -ForegroundColor Gray

# Build environment variable for password
$env:PGPASSWORD = $Password

try {
    & $psqlPath -h $Host -p $Port -U $User -d $Database -f $ScriptPath
    Write-Host "Script executed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Error executing script: $_" -ForegroundColor Red
    exit 1
}
finally {
    # Clear password from environment
    $env:PGPASSWORD = ""
}
