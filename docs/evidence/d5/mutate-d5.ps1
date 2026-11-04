# Each mutant removes one D5 guard from contracts/AssetToken.sol and runs the D5 suite.
# A mutant is "killed" when at least one test fails. The original bytes are always restored.
param([string]$Out, [string]$Backup)
$file = (Resolve-Path "contracts/AssetToken.sol").Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
Copy-Item $file $Backup -Force
$origBytes = [IO.File]::ReadAllBytes($file)
$orig = [IO.File]::ReadAllText($file, $utf8)
$eol = if ($orig.Contains("`r`n")) { "`r`n" } else { "`n" }
$mutants = [ordered]@{
  "M1 no pause check in _update"           = @("        _requireNotPaused();$eol", "")
  "M2 no zero-address source check"        = @("        if (from == address(0)) revert ForcedTransferFromZeroAddress();$eol", "")
  "M3 no whitelisted-source check"         = @("        if (isWhitelisted[from]) revert ForcedTransferFromWhitelisted(from);$eol", "")
  "M4 forcedTransfer goes through _update" = @("        super._update(from, to, amount);", "        _update(from, to, amount);")
}
$lines = @("# D5 mutation check, $(Get-Date -Format s), base commit $(git rev-parse --short HEAD) plus uncommitted D5 work")
try {
  foreach ($name in $mutants.Keys) {
    $old, $new = $mutants[$name]
    if (-not $orig.Contains($old)) { $lines += "$name : MUTATION NOT APPLIED (pattern not found)"; continue }
    [IO.File]::WriteAllText($file, $orig.Replace($old, $new), $utf8)
    $res = npx hardhat test mocha test/AssetToken.D5.test.ts 2>&1 | Out-String
    $pass = [regex]::Match($res, '(\d+) passing').Groups[1].Value
    $fail = [regex]::Match($res, '(\d+) failing').Groups[1].Value
    $verdict = if ($fail) { "KILLED" } else { "SURVIVED" }
    $lines += "$name : $verdict (passing=$pass failing=$(if ($fail) { $fail } else { 0 }))"
  }
} finally {
  [IO.File]::WriteAllBytes($file, $origBytes)
}
[IO.File]::WriteAllLines($Out, [string[]]$lines, $utf8)
$lines
