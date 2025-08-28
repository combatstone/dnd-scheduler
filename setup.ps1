# setup.ps1 - generate D&D Scheduler project from dump

Write-Host "Creating project folders..."
New-Item -ItemType Directory -Force -Path "app\campaign\[id]" | Out-Null
New-Item -ItemType Directory -Force -Path "app\dashboard" | Out-Null
New-Item -ItemType Directory -Force -Path "lib" | Out-Null
New-Item -ItemType Directory -Force -Path "components" | Out-Null

function Write-File {
    param(
        [string]$Filename,
        [string]$StartMarker,
        [string]$EndMarker
    )
    Write-Host "Writing $Filename"
    $lines = Get-Content d_d_scheduler_next.jsx
    $start = ($lines | Select-String -Pattern "^# File: $StartMarker").LineNumber
    $end   = ($lines | Select-String -Pattern "^# File: $EndMarker").LineNumber

    if ($null -eq $start -or $null -eq $end) {
        Write-Host "⚠️ Skipping $Filename (markers not found)"
        return
    }

    $content = $lines[($start) .. ($end - 2)]  # drop markers
    $content | Set-Content $Filename -Encoding UTF8
}

# Root files
Write-File "package.json" "package.json" "tsconfig.json"
Write-File "tsconfig.json" "tsconfig.json" "next.config.js"
Write-File "next.config.js" "next.config.js" "postcss.config.js"
Write-File "postcss.config.js" "postcss.config.js" "tailwind.config.ts"
Write-File "tailwind.config.ts" "tailwind.config.ts" "app/globals.css"
Write-File "app/globals.css" "app/globals.css" ".env.local.example"
Write-File ".env.local.example" ".env.local.example" "lib/firebase.ts"
Write-File "lib/firebase.ts" "lib/firebase.ts" "lib/types.ts"
Write-File "lib/types.ts" "lib/types.ts" "lib/firestore.ts"
Write-File "lib/firestore.ts" "lib/firestore.ts" "firestore.rules"
Write-File "firestore.rules" "firestore.rules" "app/layout.tsx"
Write-File "app/layout.tsx" "app/layout.tsx" "app/page.tsx"
Write-File "app/page.tsx" "app/page.tsx" "app/dashboard/page.tsx"
Write-File "app/dashboard/page.tsx" "app/dashboard/page.tsx" "app/campaign/[id]/page.tsx"
Write-File "app/campaign/[id]/page.tsx" "app/campaign/[id]/page.tsx" "README.md"
Write-File "README.md" "README.md" "END_OF_FILES"

Write-Host "✅ Setup complete!"
Write-Host "Next steps:"
Write-Host "  npm install"
Write-Host "  npm run dev"