/**
 * Wacht tot Vercel een production-deploy heeft die exact aan deze commit-SHA hangt
 * en in state READY zit. Faalt na timeout.
 *
 * Gebruikt door .github/workflows/repin-public-sites-aliases.yml
 *
 * Env:
 *   VERCEL_API_TOKEN
 *   VERCEL_TEAM_ID
 *   VERCEL_PUBLIC_SITES_PROJECT_ID
 *   GITHUB_SHA              (auto-set door GH Actions)
 *   WAIT_TIMEOUT_SECONDS    (optioneel, default 600s)
 *   WAIT_INTERVAL_SECONDS   (optioneel, default 10s)
 */

const TOKEN = process.env.VERCEL_API_TOKEN
const TEAM_ID = process.env.VERCEL_TEAM_ID
const PROJECT_ID = process.env.VERCEL_PUBLIC_SITES_PROJECT_ID
const SHA = process.env.GITHUB_SHA
const TIMEOUT = Number(process.env.WAIT_TIMEOUT_SECONDS || 600)
const INTERVAL = Number(process.env.WAIT_INTERVAL_SECONDS || 10)

if (!TOKEN || !PROJECT_ID || !SHA) {
  console.error('Mist VERCEL_API_TOKEN, VERCEL_PUBLIC_SITES_PROJECT_ID of GITHUB_SHA')
  process.exit(1)
}

const teamQ = TEAM_ID ? `&teamId=${encodeURIComponent(TEAM_ID)}` : ''

async function findDeploy() {
  const url = `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&target=production&limit=20${teamQ}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!res.ok) throw new Error(`Vercel API ${res.status} ${await res.text()}`)
  const json = await res.json()
  return (json.deployments || []).find(d => d.meta?.githubCommitSha === SHA) || null
}

const deadline = Date.now() + TIMEOUT * 1000
console.log(`Wachten op Vercel-deploy voor SHA ${SHA.slice(0, 7)} (timeout ${TIMEOUT}s)...`)

while (Date.now() < deadline) {
  const d = await findDeploy()
  if (d) {
    console.log(`  → ${d.uid}  state=${d.state || d.readyState}`)
    if (d.state === 'READY' || d.readyState === 'READY') {
      console.log(`✅ Deploy ${d.uid} is READY`)
      process.exit(0)
    }
    if (d.state === 'ERROR' || d.readyState === 'ERROR' || d.state === 'CANCELED') {
      console.error(`❌ Deploy ${d.uid} eindigde in ${d.state || d.readyState}`)
      process.exit(1)
    }
  } else {
    console.log('  → nog geen deploy zichtbaar voor deze SHA')
  }
  await new Promise(r => setTimeout(r, INTERVAL * 1000))
}

console.error(`❌ Timeout na ${TIMEOUT}s — geen READY deploy voor ${SHA.slice(0, 7)}`)
process.exit(1)
