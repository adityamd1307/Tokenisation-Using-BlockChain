param([int]$From = 0, [int]$To = 999)
# Throwaway mutation runner. Applies one textual mutant, runs the suite,
# records passing/failing, restores the file with git checkout.
$ErrorActionPreference = 'Continue'
$enc = New-Object System.Text.UTF8Encoding($false)
$T = 'contracts/AssetToken.sol'; $S = 'contracts/AssetSale.sol'; $F = 'contracts/AssetFactory.sol'
$m = @(
  @('M01 _update: drop sender whitelist check', $T, 'if (from != address(0) && !isWhitelisted[from]) revert SenderNotWhitelisted(from);', ''),
  @('M02 _update: drop recipient whitelist check', $T, 'if (to != address(0) && !isWhitelisted[to]) revert RecipientNotWhitelisted(to);', ''),
  @('M03 setWhitelisted: COMPLIANCE_ROLE -> DEFAULT_ADMIN_ROLE', $T, 'external onlyRole(COMPLIANCE_ROLE)', 'external onlyRole(DEFAULT_ADMIN_ROLE)'),
  @('M04 setWhitelisted: drop no-op early return', $T, 'if (isWhitelisted[investor] == approved) return;', ''),
  @('M05 buyTokens: payment != -> < (overpay accepted)', $S, 'if (msg.value != cost)', 'if (msg.value < cost)'),
  @('M06 buyTokens: payment != -> > (underpay accepted)', $S, 'if (msg.value != cost)', 'if (msg.value > cost)'),
  @('M07 buyTokens: drop inventory check', $S, 'if (quantity > available) revert InsufficientInventory(quantity, available);', ''),
  @('M08 buyTokens: inventory > -> >=', $S, 'if (quantity > available)', 'if (quantity >= available)'),
  @('M09 buyTokens: drop buyer whitelist check', $S, 'if (!assetToken.isWhitelisted(msg.sender)) revert InvestorNotWhitelisted(msg.sender);', ''),
  @('M10 buyTokens: drop quantity==0 check', $S, "    function buyTokens(uint256 quantity) external payable whenOpen {`n        if (quantity == 0) revert InvalidQuantity();", "    function buyTokens(uint256 quantity) external payable whenOpen {"),
  @('M11 buyTokens: drop whenOpen', $S, 'function buyTokens(uint256 quantity) external payable whenOpen {', 'function buyTokens(uint256 quantity) external payable {'),
  @('M12 allocate: drop whenOpen', $S, 'function allocate(uint256 amount) external onlyIssuer whenOpen {', 'function allocate(uint256 amount) external onlyIssuer {'),
  @('M13 closeSale: drop whenOpen', $S, 'function closeSale() external onlyIssuer whenOpen {', 'function closeSale() external onlyIssuer {'),
  @('M14 recoverUnsoldTokens: drop saleClosed gate', $S, 'if (!saleClosed) revert SaleNotClosed();', ''),
  @('M15 onlyIssuer: empty modifier body check', $S, 'if (msg.sender != issuer) revert NotIssuer();', ''),
  @('M16 withdrawProceeds: drop onlyIssuer', $S, 'function withdrawProceeds() external onlyIssuer {', 'function withdrawProceeds() external {'),
  @('M17 allocate: drop onlyIssuer', $S, 'function allocate(uint256 amount) external onlyIssuer whenOpen {', 'function allocate(uint256 amount) external whenOpen {'),
  @('M18 recoverUnsoldTokens: drop onlyIssuer', $S, 'function recoverUnsoldTokens() external onlyIssuer {', 'function recoverUnsoldTokens() external {'),
  @('M19 withdrawProceeds: CEI violated (zero after call)', $S, "        unclaimedProceeds = 0;`n        (bool ok, ) = issuer.call{value: amount}(`"`");", "        (bool ok, ) = issuer.call{value: amount}(`"`");`n        unclaimedProceeds = 0;"),
  @('M20 withdrawProceeds: never zero proceeds', $S, '        unclaimedProceeds = 0;', ''),
  @('M21 withdrawProceeds: ignore failed send', $S, 'if (!ok) revert WithdrawalFailed();', ''),
  @('M22 buyTokens: proceeds not recorded', $S, 'unclaimedProceeds += msg.value;', ''),
  @('M23 withdrawProceeds: pay address(this).balance', $S, 'uint256 amount = unclaimedProceeds;', 'uint256 amount = address(this).balance;'),
  @('M24 createAsset: drop authorisation check', $F, 'if (!authorisedIssuers[msg.sender]) revert IssuerNotAuthorised(msg.sender);', ''),
  @('M25 createAsset: drop price==0 check (sale ctor still checks)', $F, 'if (unitPriceWei == 0) revert InvalidPrice();', ''),
  @('M26 onlyAdmin: empty modifier body check', $F, 'if (msg.sender != admin) revert NotAdmin();', ''),
  @('M27 revokeIssuer: drop state change', $F, '        authorisedIssuers[issuer] = false;', ''),
  @('M28 createAsset: drop tokenToSale write', $F, 'tokenToSale[address(token)] = address(sale);', ''),
  @('M29 allocate: drop amount==0 check', $S, "        if (amount == 0) revert InvalidQuantity();`n        assetToken.safeTransferFrom", "        assetToken.safeTransferFrom"),
  @('M30 setWhitelisted: drop zero-address check', $T, 'if (investor == address(0)) revert InvalidInvestor();', '')
)
$results = @()
for ($i = $From; $i -le [Math]::Min($To, $m.Count - 1); $i++) {
  $name, $file, $old, $new = $m[$i]
  $path = Join-Path (Get-Location) $file
  $src = [IO.File]::ReadAllText($path) -replace "`r`n", "`n"
  $count = ([regex]::Matches($src, [regex]::Escape($old))).Count
  if ($count -ne 1) { $results += "$name | NOT APPLIED (matches=$count)"; continue }
  [IO.File]::WriteAllText($path, $src.Replace($old, $new), $enc)
  try {
    $out = (npx hardhat test 2>&1 | Out-String)
  } finally {
    git checkout -- $file
  }
  $pass = if ($out -match '(\d+) passing') { $Matches[1] } else { '?' }
  $fail = if ($out -match '(\d+) failing') { $Matches[1] } else { '0' }
  $compileErr = if ($out -match 'Error HH|CompilerError|ParserError|TypeError:') { ' COMPILE/RUN-ERROR' } else { '' }
  $verdict = if ($fail -ne '0' -or $compileErr) { 'KILLED' } else { 'SURVIVED' }
  $failed = ([regex]::Matches($out, '(?m)^\s+\d+\) .*$') | Select-Object -First 4 | ForEach-Object { $_.Value.Trim() }) -join ' || '
  $results += "$name | $verdict | pass=$pass fail=$fail$compileErr | $failed"
}
$results
