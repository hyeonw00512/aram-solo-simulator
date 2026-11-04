$ErrorActionPreference = 'Stop'
$championIds = @('Ahri','Ashe','Blitzcrank','Darius','Janna','Kaisa','Kennen','Leona','Lux','Malphite','Morgana','Nami','Sona','Veigar','Vex','Yasuo')
$growthRecords = [ordered]@{}
foreach ($championId in $championIds) {
  $slug = $championId.ToLowerInvariant()
  $sourceUrl = "https://raw.communitydragon.org/16.21/game/data/characters/$slug/$slug.bin.json"
  $rawPath = Join-Path $PSScriptRoot "../data/raw/$slug-16.21.bin.json"
  if (-not (Test-Path -LiteralPath $rawPath)) { Invoke-WebRequest -Uri $sourceUrl -OutFile $rawPath }
  $raw = Get-Content -Raw -LiteralPath $rawPath | ConvertFrom-Json -AsHashtable
  $record = @($raw.Values | Where-Object { $_.__type -eq 'CharacterRecord' })
  if ($record.Count -ne 1) { throw "Ambiguous CharacterRecord for $championId" }
  $growth = $record[0].damagePerLevelModifiable.baseValue
  $ratio = $record[0].attackSpeedRatioModifiable.baseValue
  if ($null -eq $growth -or $null -eq $ratio -or $growth -le 0 -or $ratio -le 0) { throw "Invalid growth stats for $championId" }
  $growthRecords[$championId] = [ordered]@{attackdamageperlevel=[math]::Round($growth,6);attackspeedratio=[math]::Round($ratio,6);source=$sourceUrl}
}
$result = [ordered]@{version='16.21';source='Riot game CharacterRecord via CommunityDragon';reason='Data Dragon attackdamageperlevel is zero; attack speed ratio is not exposed';champions=$growthRecords}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot '../data/champion-growth.json')
$growthRecords | ConvertTo-Json -Depth 3
