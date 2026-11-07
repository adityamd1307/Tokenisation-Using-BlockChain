# Applies one mutant to blockchain.ts in the verification worktree, runs the full frontend suite, restores the file.
param([string]$Worktree, [string]$OutDir)
$file = Join-Path $Worktree "frontend/src/services/blockchain.ts"
$mutants = [ordered]@{
  "M1-drop-ready-provider" = @(,@("    await this.ready(provider);`n", ""))
  "M2-ready-ignores-param" = @(
    @("const chain = await provider.getNetwork();", "const chain = await this.provider.getNetwork();"),
    @("const code = await provider.getCode(", "const code = await this.provider.getCode("),
    @("const block = await provider.getBlock(", "const block = await this.provider.getBlock("))
  "M3-blockhash-from-public-rpc" = @(,@("const block = await provider.getBlock(", "const block = await this.provider.getBlock("))
  "M4-drop-post-ready-recheck" = @(@("    const [currentChain, currentAccounts] = await Promise.all([", "    /*const [currentChain, currentAccounts] = await Promise.all(["),
                                   @("      throw new Error(`"Wallet account changed. Review the form and try again.`");`n    return provider.getSigner", "      throw new Error(`"Wallet account changed. Review the form and try again.`");*/`n    return provider.getSigner"))
}
$orig = [System.IO.File]::ReadAllText($file)
$nl = if ($orig.Contains("`r`n")) { "`r`n" } else { "`n" }
foreach ($name in $mutants.Keys) {
  $text = $orig
  foreach ($pair in $mutants[$name]) {
    $from = $pair[0].Replace("`n", $nl); $to = $pair[1].Replace("`n", $nl)
    $idx = $text.IndexOf($from)
    if ($idx -lt 0) { throw "$name : pattern not found: $from" }
    if ($text.IndexOf($from, $idx + 1) -ge 0 -and $name -ne "M4-drop-post-ready-recheck") { throw "$name : pattern not unique" }
    $text = $text.Substring(0, $idx) + $to + $text.Substring($idx + $from.Length)
  }
  [System.IO.File]::WriteAllText($file, $text)
  Push-Location $Worktree
  npm test --prefix frontend *> (Join-Path $OutDir "out-$name.log")
  $code = $LASTEXITCODE
  Pop-Location
  $summary = (Select-String -Path (Join-Path $OutDir "out-$name.log") -Pattern '^\s+Tests ').Line
  $failed = (Select-String -Path (Join-Path $OutDir "out-$name.log") -Pattern '^\s+×' | ForEach-Object { $_.Line.Trim() }) -join " | "
  "$name exit=$code $summary"
  if ($failed) { "   failed: $failed" }
  [System.IO.File]::WriteAllText($file, $orig)
}
