npx playwright test --project=setup --project=cifro
$code1 = $LASTEXITCODE
npx playwright test --project=setup --project=serial --workers=1
$code2 = $LASTEXITCODE
exit [Math]::Max($code1, $code2)
