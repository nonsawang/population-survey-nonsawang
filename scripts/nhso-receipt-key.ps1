param([Parameter(Mandatory=$true)][string]$KeyPath,[switch]$Create)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
if ($Create) {
 if (Test-Path -LiteralPath $KeyPath) { throw 'KEY_ALREADY_EXISTS' }
 $keyBytes=New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try { $rng.GetBytes($keyBytes) } finally { $rng.Dispose() }
 $protected=[Security.Cryptography.ProtectedData]::Protect($keyBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $stream=[IO.File]::Open($KeyPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try { $stream.Write($protected,0,$protected.Length);$stream.Flush($true) } finally { $stream.Dispose();[Array]::Clear($keyBytes,0,$keyBytes.Length) }
} else {
 $protected=[IO.File]::ReadAllBytes($KeyPath)
 $keyBytes=[Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 try { if($keyBytes.Length -ne 32){throw 'INVALID_KEY'};[Console]::Out.Write([Convert]::ToBase64String($keyBytes)) } finally { [Array]::Clear($keyBytes,0,$keyBytes.Length) }
}
