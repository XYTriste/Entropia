# Scheduler Constraint Test Script
# Test scheduling with different constraint configurations

$BASE_URL = "http://localhost:8000/api"

# Test configurations
$testCases = @(
    @{
        name = "Both Constraints ON"
        enable_max_days_constraint = $true
        enable_day_continuity_constraint = $true
    },
    @{
        name = "Both Constraints OFF"
        enable_max_days_constraint = $false
        enable_day_continuity_constraint = $false
    },
    @{
        name = "Only Max Days Constraint ON"
        enable_max_days_constraint = $true
        enable_day_continuity_constraint = $false
    },
    @{
        name = "Only Continuity Constraint ON"
        enable_max_days_constraint = $false
        enable_day_continuity_constraint = $true
    }
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scheduler Constraint Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($test in $testCases) {
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    Write-Host "Test: $($test.name)" -ForegroundColor Yellow
    Write-Host "  enable_max_days_constraint: $($test.enable_max_days_constraint)"
    Write-Host "  enable_day_continuity_constraint: $($test.enable_day_continuity_constraint)"
    Write-Host "----------------------------------------" -ForegroundColor Yellow

    # 1. Update config
    $configBody = @{
        fixed_teachers_per_room = 2
        patrol_teacher_count_per_slot_pair = 2
        enable_max_days_constraint = $test.enable_max_days_constraint
        enable_day_continuity_constraint = $test.enable_day_continuity_constraint
    } | ConvertTo-Json

    try {
        $configResult = Invoke-RestMethod -Uri "$BASE_URL/scheduler/config" -Method Put -Body $configBody -ContentType "application/json"
        if ($configResult.code -eq 0) {
            Write-Host "  [OK] Config updated" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Config update failed: $($configResult.message)" -ForegroundColor Red
            continue
        }
    } catch {
        Write-Host "  [FAIL] Config request failed: $_" -ForegroundColor Red
        continue
    }

    # 2. Start scheduling
    try {
        # Request body for scheduling
        $runBody = @{
            course_ids = $null  # All courses
            strategy = "full"
        } | ConvertTo-Json

        Write-Host "  [INFO] Starting scheduling..." -ForegroundColor Cyan
        $startResult = Invoke-RestMethod -Uri "$BASE_URL/scheduler/run" -Method Post -Body $runBody -ContentType "application/json" -TimeoutSec 600

        if ($startResult.code -eq 0 -and $startResult.data) {
            $jobId = $startResult.data.job_id
            Write-Host "  [INFO] Job started: $jobId" -ForegroundColor Cyan

            # 3. Poll status with job_id
            $maxAttempts = 180
            $attempt = 0
            $success = $false
            $failed = $false

            while ($attempt -lt $maxAttempts) {
                Start-Sleep -Seconds 2
                $attempt++

                try {
                    $status = Invoke-RestMethod -Uri "$BASE_URL/scheduler/status/$jobId" -Method Get -TimeoutSec 10

                    if ($status.data.status -eq "completed" -or $status.data.status -eq "completed_with_violations") {
                        Write-Host "  [SUCCESS] Scheduling completed!" -ForegroundColor Green
                        if ($status.data.result) {
                            $result = $status.data.result
                            Write-Host "    - Public courses: $($result.public_courses_scheduled)/$($result.public_courses_total)"
                            Write-Host "    - Professional courses: $($result.professional_courses_scheduled)/$($result.professional_courses_total)"
                            Write-Host "    - Total exams: $($result.total_exams)"
                            Write-Host "    - Solve time: $($result.solve_time)s"
                            if ($result.violations -and $result.violations.Count -gt 0) {
                                Write-Host "    - Violations: $($result.violations.Count)" -ForegroundColor DarkYellow
                            }
                        }
                        $success = $true
                        break
                    } elseif ($status.data.status -eq "failed") {
                        Write-Host "  [FAIL] Scheduling failed!" -ForegroundColor Red
                        if ($status.data.error) {
                            Write-Host "    - Error: $($status.data.error)" -ForegroundColor Red
                        }
                        $failed = $true
                        break
                    } elseif ($status.data.status -eq "running") {
                        if ($attempt % 10 -eq 0) {
                            Write-Host "    - Status: running (waiting... $attempt/$maxAttempts)" -ForegroundColor DarkYellow
                        }
                    } else {
                        Write-Host "    - Status: $($status.data.status)" -ForegroundColor DarkYellow
                    }
                } catch {
                    if ($attempt % 20 -eq 0) {
                        Write-Host "    - Status check failed: $_ (retrying...)" -ForegroundColor DarkYellow
                    }
                }
            }

            if (-not $success -and -not $failed) {
                Write-Host "  [TIMEOUT] Scheduling timeout (>360s)" -ForegroundColor Red
            }
        } else {
            Write-Host "  [FAIL] Failed to start job: $($startResult.message)" -ForegroundColor Red
        }

    } catch {
        Write-Host "  [FAIL] Scheduling request failed: $_" -ForegroundColor Red
    }

    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
