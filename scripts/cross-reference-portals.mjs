#!/usr/bin/env node
// Cross-reference ZIP folder namen met DB platform namen.
// Gebruikt fuzzy matching omdat DB veel typos heeft vs Kay's standaard spelling.

import fs from 'node:fs'

const INVENTORY = '/Users/kennylipman/Lokale-Banen/.branding-staging/branding-inventory.json'
const OUTPUT_MD = '/Users/kennylipman/Lokale-Banen/.branding-staging/PORTAL-MAPPING.md'
const OUTPUT_JSON = '/Users/kennylipman/Lokale-Banen/.branding-staging/portal-mapping.json'

// Snapshot van DB platforms op 2026-04-15
const DB_PLATFORMS = [
  { id: 'fefccc96-4296-4370-a715-ca2cb10c1aa9', regio_platform: 'AalsmeerseBanen', domain: null, is_public: false },
  { id: '6c3e7456-bf45-4b3b-a061-513f1b4354c7', regio_platform: 'AchterhoekseBanen', domain: 'achterhoeksebanen.nl', is_public: true },
  { id: '7f96cd64-f6d7-4bac-8898-6a6fcacc7eee', regio_platform: 'AlkmaarseBanen', domain: 'alkmaarsebanen.nl', is_public: true },
  { id: 'f0f06711-5b04-45dd-9433-edd7f14f5d4b', regio_platform: 'AlmeerseBanen', domain: null, is_public: false },
  { id: 'c333a1c7-ac4c-4c6f-89c2-60b3c3bf654b', regio_platform: 'AlmeloseBanen', domain: 'almelosebanen.nl', is_public: true },
  { id: '13548798-b144-4e1f-823d-3574f988f6e5', regio_platform: 'AlphenseBanen', domain: null, is_public: false },
  { id: 'cb9e2a89-d89f-496d-b3eb-14c818771c33', regio_platform: 'AmersfoortseBanen', domain: 'amersfoortsebanen.nl', is_public: true },
  { id: 'ee8b05d1-ac4a-48a8-af3d-c3a4388a9041', regio_platform: 'AmsterdamseBanen', domain: null, is_public: false },
  { id: 'd90b5220-faf1-43aa-8479-3020d1b3cb34', regio_platform: 'ApeldoornseBanen', domain: null, is_public: false },
  { id: '77c73136-580f-4b48-93bc-98753ba5c5b9', regio_platform: 'ArnhemseBanen', domain: 'arnhemsebanen.nl', is_public: true },
  { id: 'cba3bd0e-ee5c-45dc-889b-0df2f36c9bcd', regio_platform: 'AssenseBanen', domain: 'assensebanen.nl', is_public: true },
  { id: '2acccca9-1c0a-4819-8084-8b7e283dd649', regio_platform: 'BarendrechtseBanen', domain: null, is_public: false },
  { id: 'a08d45dd-53e6-4537-a520-ae2c729fb980', regio_platform: 'BollenstreekseBanen', domain: null, is_public: false },
  { id: '0d48ccb5-8627-4988-94e6-572d678077a1', regio_platform: 'BosscheBanen', domain: 'bosschebanen.nl', is_public: true },
  { id: 'f4c9c2c2-0eb8-44b3-957c-74d5461677be', regio_platform: 'BredaseBanen', domain: 'bredasebanen.nl', is_public: true },
  { id: 'a297031e-d804-4936-a2f2-e5368c46a140', regio_platform: 'DelftseBanen', domain: null, is_public: false },
  { id: '21e145c2-b625-46a2-922f-f13f37b15321', regio_platform: 'DeventerseBanen', domain: 'deventersebanen.nl', is_public: true },
  { id: '9bf49b28-b10c-454a-840f-30175cf9719e', regio_platform: 'DrechtseBanen', domain: null, is_public: false },
  { id: '7f86bef5-c9c2-421b-8af2-829dfa7288ce', regio_platform: 'EindhovenseBanen', domain: 'eindhovensebanen.nl', is_public: true },
  { id: 'a0f14978-ec03-44ab-bff2-5cae72fb5b0f', regio_platform: 'EmmeloordseBanen', domain: 'emmeloordsebanen.nl', is_public: true },
  { id: '7c0f5e54-04bf-4773-8f8b-8f14b43ae16b', regio_platform: 'Emmensebanen', domain: 'emmensebanen.nl', is_public: true },
  { id: 'a09b6888-015a-4177-bb7f-534a55ff9780', regio_platform: 'EnschedeseBanen', domain: 'enschedesebanen.nl', is_public: true },
  { id: 'db4d89cc-a9fe-4072-87bd-180e020af461', regio_platform: 'GoudseBanen', domain: null, is_public: false },
  { id: 'abab1d0d-069f-46fb-a75d-2b6e2b931fc3', regio_platform: 'GroningseBanen', domain: 'groningsebanen.nl', is_public: true },
  { id: 'c07d8bac-9f28-43fe-87ec-a3df50112718', regio_platform: 'HaagseBanen', domain: null, is_public: false },
  { id: 'e707dd93-101e-4138-a548-ae1b62c1f273', regio_platform: 'HaarlemseBanen', domain: null, is_public: false },
  { id: 'c246ce8d-f328-4f73-9e6c-3d47ac0cb34d', regio_platform: 'HarderwijkseBanen', domain: null, is_public: false },
  { id: '5d00a88a-61e7-4d14-9376-8b3edb2656d4', regio_platform: 'HeerenveenseBanen', domain: 'heerenveensebanen.nl', is_public: true },
  { id: '45408cf3-d382-4b30-b591-6a93e162f96f', regio_platform: 'HelmondseBanen', domain: 'helmondsebanen.nl', is_public: true },
  { id: '491ca839-9158-41f2-b4e6-b77c24fb9550', regio_platform: 'HoekscheBanen', domain: null, is_public: false },
  { id: 'f54d8295-e431-468d-a9f4-8bdc57b55a32', regio_platform: 'HoofddorpseBanen', domain: null, is_public: false },
  { id: '36bcbfa7-ba7c-4623-8e7c-40b01206aebe', regio_platform: 'InactivePlatformBanen', domain: null, is_public: false },
  { id: '8c694c78-abd5-455c-826a-7d9e102dfe6e', regio_platform: 'LansingerlandseBanen', domain: null, is_public: false },
  { id: '7404b9df-0b4c-4053-88d6-738b4dbef7d9', regio_platform: 'LeeuwardseBanen', domain: 'leeuwardsebanen.nl', is_public: true },
  { id: 'a15acfb1-20b7-4d29-9f1b-aaf4fe250555', regio_platform: 'LeidseBanen', domain: null, is_public: false },
  { id: 'be976e32-8f6e-4fe9-9040-006f6ff07abd', regio_platform: 'MaasluisseBanen', domain: null, is_public: false },
  { id: '5b1aefd1-a858-4cc9-bcf7-32271b198627', regio_platform: 'MaastrichtseBanen', domain: 'maastrichtsebanen.nl', is_public: true },
  { id: 'a4bc6eed-b9b3-40b3-856e-40c2f7aa8634', regio_platform: 'master', domain: 'lokalebanen.nl', is_public: false },
  { id: '49c50ac7-91af-4b2b-b054-f0962e1d77b1', regio_platform: 'NijmegenseBanen', domain: 'nijmegensebanen.nl', is_public: true },
  { id: '54313a3f-c280-4827-beb6-51443e163c5d', regio_platform: 'OosterhoutseBanen', domain: null, is_public: false },
  { id: '000d5d97-ee4a-46ea-b782-e6a0bd57dfdd', regio_platform: 'OssseBanen', domain: 'osssebanen.nl', is_public: true },
  { id: 'b7ca1187-01e7-4634-90ef-a6d243c966ee', regio_platform: 'RoosendaalseBanen', domain: 'roosendaalsebanen.nl', is_public: true },
  { id: '4aaaaa41-f5aa-4137-88f7-7932a097087f', regio_platform: 'RotterdamseBanen', domain: null, is_public: false },
  { id: '36c96be7-2fd2-4324-8b43-fc3eab9947c5', regio_platform: 'SchiedamseBanen', domain: null, is_public: false },
  { id: 'e78bcfa5-6914-41ee-85a7-6369d1dd8505', regio_platform: 'TestLinkingBanen', domain: null, is_public: false },
  { id: '9fa1b83b-1614-4322-8736-e43f6beaa240', regio_platform: 'TestPlatformBanen', domain: null, is_public: false },
  { id: '6243f463-ff8f-4932-972e-ec216ceed926', regio_platform: 'TilburgseBanen', domain: null, is_public: false },
  { id: '1ddeeaa2-5f73-4862-8c81-d10e92126c4a', regio_platform: 'UtrechtseBanen', domain: 'utrechtsebanen.nl', is_public: true },
  { id: '1e047899-0692-454c-9d85-5ab9e2b7c624', regio_platform: 'VenloseBanen', domain: 'venlosebanen.nl', is_public: true },
  { id: '56316b02-313a-4471-af5a-9b035331281c', regio_platform: 'VlaardingeseBanen', domain: null, is_public: false },
  { id: 'bd57b8c3-9b2b-4188-8715-e328bd803146', regio_platform: 'VoornseBanen', domain: null, is_public: false },
  { id: 'da39dfe4-0fb0-42c2-9325-f13fa8cab9ce', regio_platform: 'WeerterseBanen', domain: null, is_public: false },
  { id: '6c6f5971-065d-4c3d-844a-787d437a32c1', regio_platform: 'WestlandseBanen', domain: 'westlandsebanen.nl', is_public: true },
  { id: '7a29678c-9fea-454b-b3d6-76047d52e633', regio_platform: 'WoerdenseBanen', domain: null, is_public: false },
  { id: '8fb90e86-ed7a-4c2d-b0cc-78069661fd80', regio_platform: 'ZaanseBanen', domain: null, is_public: false },
  { id: 'd77d9647-efcd-46b6-96b3-3a841eae2696', regio_platform: 'ZeeuwseBanen', domain: 'zeeuwsebanen.nl', is_public: true },
  { id: '1eb51b7b-4216-41b3-a40a-0e510022f50e', regio_platform: 'ZoetermeerseBanen', domain: null, is_public: false },
  { id: 'f95f7017-80ec-43c2-8886-1fd7b26e94e1', regio_platform: 'ZwolseBanen', domain: null, is_public: false },
]

// Expliciete mapping ZIP-folder → DB regio_platform (voor gevallen die fuzzy niet oplost)
const EXPLICIT_MAP = {
  'OsseBanen': 'OssseBanen',                     // DB typo: extra s
  'LeeuwardenseBanen': 'LeeuwardseBanen',        // DB typo: mist 'n'
  'MaassluiseBanen': 'MaasluisseBanen',          // DB typo: ss/ss swap
  'VlaardingseBanen': 'VlaardingeseBanen',       // DB typo: extra e
  'WeerterBanen': 'WeerterseBanen',              // DB typo: extra se
  'Drechtsebanen': 'DrechtseBanen',              // casing verschil
  'HardewijkseBanen': 'HarderwijkseBanen',       // ZIP typo: mist r
  'WoerdseBanen': 'WoerdenseBanen',              // ZIP typo: mist en
  'EmmenseBanen': 'Emmensebanen',                // DB heeft lowercase b
  'TilburgesBanen (non JZ)': 'TilburgseBanen',   // ZIP typo: TilburgEs ipv Tilburgse + (non JZ) suffix
  'OosterhoutseBanen (non JZ)': 'OosterhoutseBanen', // (non JZ) suffix betekent: non-JobZone versie
  'AmersfoortseBanen': 'AmersfoortseBanen',      // exact match (bestandsnaam heeft typo 'amerfoortsebanen')
  // Portalen zonder DB-mapping (nog):
  'WerkenInAalsmeer': null,                       // subbrand, geen *Banen platform
  'Vacature Westland': null,                      // subbrand / marketing asset
  'LokaleBanen': 'master',                        // master platform
  // ZIP portalen die mogelijk nieuwe platforms zijn (nog niet in DB):
  'BARseBanen': null,          // BAR = Barendrecht/Albrandswaard/Ridderkerk regio
  'BrabantseBanen': null,      // Brabant provincie
  'DrentseBanen': null,        // Drenthe provincie — LET OP: NIET DrechtseBanen!
  'FlevolandseBanen': null,    // Flevoland provincie
  'FriesseBanen': null,        // Friesland provincie
  'HortiBanen': null,          // sector: tuinbouw
  'LimburgseBanen': null,      // Limburg provincie — LET OP: NIET TilburgseBanen!
  'NijmeegseBanen': 'NijmegenseBanen', // DB heeft extra 'se' — mogelijk DB typo
  'RoermondseBanen': null,     // Roermond stad
  'WaalwijkseBanen': null,     // Waalwijk stad
  'WaterwegseBanen': null,     // Waterweg (Vlaardingen+Schiedam regio)
  'WestlandseStages': null,    // subbrand Westland (stages, niet banen)
  'ZeelandseBanen': null,      // Zeeland — overlap met ZeeuwseBanen? vraag Kenny
  'ZuidhollandseBanen': null,  // Zuid-Holland provincie
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

function fuzzyMatch(zipName, dbPlatforms) {
  if (EXPLICIT_MAP[zipName] !== undefined) {
    const target = EXPLICIT_MAP[zipName]
    if (target === null) return { match: null, method: 'explicit-null' }
    const db = dbPlatforms.find(p => p.regio_platform === target)
    return db ? { match: db, method: 'explicit' } : { match: null, method: 'explicit-notfound' }
  }
  const nz = normalize(zipName)
  // Exact
  let found = dbPlatforms.find(p => p.regio_platform === zipName)
  if (found) return { match: found, method: 'exact' }
  // Normalize match
  found = dbPlatforms.find(p => normalize(p.regio_platform) === nz)
  if (found) return { match: found, method: 'normalized' }
  // Substring / levenshtein-ish (minor typos)
  const candidates = dbPlatforms.map(p => ({
    platform: p,
    score: levenshtein(nz, normalize(p.regio_platform)),
  }))
  candidates.sort((a, b) => a.score - b.score)
  if (candidates[0] && candidates[0].score <= 2) {
    return { match: candidates[0].platform, method: `fuzzy-${candidates[0].score}` }
  }
  return { match: null, method: 'no-match' }
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'))
const allZipEntries = [...inventory.zip1, ...inventory.zip2]

const mapping = []
for (const entry of allZipEntries) {
  const res = fuzzyMatch(entry.portal, DB_PLATFORMS)
  mapping.push({
    zip_folder: entry.portal,
    db_match: res.match ? {
      id: res.match.id,
      regio_platform: res.match.regio_platform,
      domain: res.match.domain,
      is_public: res.match.is_public,
    } : null,
    match_method: res.method,
    has_kay_colors: !!entry.kay_official,
    kay_colors: entry.kay_official,
    svg_colors: entry.colors_from_svg.brand,
  })
}

// DB platforms zonder ZIP match
const matchedPlatformIds = new Set(mapping.filter(m => m.db_match).map(m => m.db_match.id))
const dbOrphans = DB_PLATFORMS
  .filter(p => !matchedPlatformIds.has(p.id))
  .filter(p => !p.regio_platform.startsWith('Test') && !p.regio_platform.startsWith('Inactive'))

// Rapport
const md = []
md.push('# Portal Mapping — ZIP naar DB\n')
md.push(`_Gegenereerd: ${new Date().toISOString()}_\n`)
md.push(`**Totaal ZIP folders**: ${mapping.length}`)
md.push(`**Met DB match**: ${mapping.filter(m => m.db_match).length}`)
md.push(`**Zonder match / orphan in ZIP**: ${mapping.filter(m => !m.db_match).length}`)
md.push(`**DB platforms zonder branding asset**: ${dbOrphans.length}\n`)

md.push('## A. ZIP → DB Mapping\n')
md.push('| ZIP folder | DB regio_platform | Domain | Public | Kay colors | Match method |')
md.push('|------------|-------------------|--------|:------:|:----------:|--------------|')
for (const m of mapping) {
  const db = m.db_match
  const dbCol = db ? `\`${db.regio_platform}\`` : '**NO MATCH**'
  const domain = db?.domain || '–'
  const pub = db?.is_public ? '✓' : '✗'
  const kay = m.has_kay_colors ? '✓' : '–'
  const flag = m.match_method.startsWith('fuzzy')
    ? `🔧 ${m.match_method} (typo)`
    : m.match_method === 'explicit'
    ? '🔗 expliciet'
    : m.match_method === 'explicit-null'
    ? '🚫 niet in DB'
    : m.match_method === 'exact'
    ? '✓'
    : m.match_method
  md.push(`| ${m.zip_folder} | ${dbCol} | ${domain} | ${pub} | ${kay} | ${flag} |`)
}

md.push('\n## B. DB platforms zonder ZIP asset\n')
md.push('| DB regio_platform | Domain | Public |')
md.push('|-------------------|--------|:------:|')
for (const p of dbOrphans) {
  md.push(`| ${p.regio_platform} | ${p.domain || '–'} | ${p.is_public ? '✓' : '✗'} |`)
}

md.push('\n## C. DB naam-inconsistenties (typos te corrigeren)\n')
md.push('| Huidige DB | Correct (volgens ZIP/Kay) | Domain | Impact |')
md.push('|------------|---------------------------|--------|--------|')
const typoFixes = mapping
  .filter(m => m.match_method.startsWith('fuzzy') || m.match_method === 'explicit')
  .filter(m => m.db_match && m.db_match.regio_platform !== m.zip_folder)
  .filter(m => !m.zip_folder.includes('(non JZ)'))
  .filter(m => m.zip_folder !== 'LokaleBanen')
  .filter(m => {
    // Alleen echte typos, geen casing-alleen verschillen
    const zipNorm = m.zip_folder.toLowerCase()
    const dbNorm = m.db_match.regio_platform.toLowerCase()
    return zipNorm !== dbNorm
  })
for (const m of typoFixes) {
  const impact = m.db_match.is_public ? 'LIVE — ook domain' : 'Draft — alleen naam'
  md.push(`| \`${m.db_match.regio_platform}\` | \`${m.zip_folder}\` | ${m.db_match.domain || '–'} | ${impact} |`)
}

fs.writeFileSync(OUTPUT_MD, md.join('\n'))
fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ mapping, dbOrphans, typoFixes }, null, 2))
console.log(`Mapping rapport: ${OUTPUT_MD}`)
console.log(`Mapping JSON: ${OUTPUT_JSON}`)
console.log(`\n=== Summary ===`)
console.log(`ZIP folders:             ${mapping.length}`)
console.log(`Matched to DB:           ${mapping.filter(m => m.db_match).length}`)
console.log(`ZIP orphans:             ${mapping.filter(m => !m.db_match).length}`)
console.log(`DB platforms no ZIP:     ${dbOrphans.length}`)
console.log(`DB typo-fixes suggested: ${typoFixes.length}`)
