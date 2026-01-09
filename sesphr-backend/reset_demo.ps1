# Quick manual version
$baseUrl = "http://localhost:5000"

Write-Host "SeSPHR Demo Reset Script" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Create admin
Write-Host "[1/3] Creating admin user..." -ForegroundColor Yellow
$signup = @{name="Admin";username="admin";password="admin";role="admin"} | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$baseUrl/api/signup" -Method POST -ContentType "application/json" -Body $signup -UseBasicParsing -ErrorAction Stop | Out-Null
    Write-Host "✓ Admin user created" -ForegroundColor Green
} catch {
    Write-Host "⚠ Admin may already exist (continuing...)" -ForegroundColor Yellow
}

# Login
Write-Host "[2/3] Logging in as admin..." -ForegroundColor Yellow
$login = @{username="admin";password="admin"} | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri "$baseUrl/api/login" -Method POST -ContentType "application/json" -Body $login -SessionVariable webSession -UseBasicParsing -ErrorAction Stop
Write-Host "✓ Login successful" -ForegroundColor Green

# Reset
Write-Host "[3/3] Resetting demo data..." -ForegroundColor Yellow
$reset = Invoke-WebRequest -Uri "$baseUrl/api/admin/reset_demo" -Method POST -WebSession $webSession -UseBasicParsing -ErrorAction Stop
$result = $reset.Content | ConvertFrom-Json

if ($result.success) {
    Write-Host "✓ Demo data reset successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Created $($result.data.users_created) users:" -ForegroundColor Cyan
    foreach ($user in $result.data.users) {
        $attrs = ($user.attributes.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ", "
        Write-Host "  - $($user.user_id) ($($user.role)): $attrs" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Demo Users:" -ForegroundColor Cyan
    Write-Host "  Doctors: doctor1, doctor2, doctor3 (password: doctor123)" -ForegroundColor Gray
    Write-Host "  Patients: patient1, patient2, patient3 (password: patient123)" -ForegroundColor Gray
    Write-Host "  Admin: admin (password: admin)" -ForegroundColor Gray
} else {
    Write-Host "✗ Reset failed: $($result.error)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done! You can now login with any of the demo users." -ForegroundColor Green