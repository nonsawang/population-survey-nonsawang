param([switch]$Read)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$folder=Join-Path $env:LOCALAPPDATA 'Nonsawang\CloseRights'
$file=Join-Path $folder 'vhv344108.recorder.dpapi'
try {
 if($Read){
  $bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($file),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  try { [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes)) } finally { [Array]::Clear($bytes,0,$bytes.Length) }
  exit 0
 }
 if(Test-Path -LiteralPath $file){throw 'RECORDER_ALREADY_EXISTS'}
 $secret=Read-Host 'Recorder citizen ID for vhv344108 (13 digits)' -AsSecureString
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
 try {$pidText=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
 if($pidText -notmatch '^\d{13}$'){throw 'INVALID_RECORDER_ID'}
 $sum=0;for($i=0;$i -lt 12;$i++){$sum+=([int]::Parse($pidText.Substring($i,1))*(13-$i))}
 if(((11-($sum%11))%10) -ne [int]::Parse($pidText.Substring(12,1))){throw 'INVALID_RECORDER_ID'}
 [IO.Directory]::CreateDirectory($folder)|Out-Null
 $bytes=[Text.Encoding]::UTF8.GetBytes($pidText)
 try {$encrypted=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)} finally {[Array]::Clear($bytes,0,$bytes.Length);$pidText=$null}
 $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try {$stream.Write($encrypted,0,$encrypted.Length);$stream.Flush($true)} finally {$stream.Dispose()}
 Write-Host 'Recorder saved with Windows DPAPI. No API request sent.'
} catch { Write-Error 'Recorder setup/read failed. Check ID, existing file and Windows user profile.'; exit 1 }
