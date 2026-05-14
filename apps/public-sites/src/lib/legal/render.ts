import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { unstable_cache } from 'next/cache'

type LegalType = 'terms' | 'privacy'

const TEMPLATE_FILE: Record<LegalType, string> = {
  terms: 'terms-template.md',
  privacy: 'privacy-template.md',
}

/**
 * Load + cache de markdown-template van schijf. Wordt 1x per server-process gelezen
 * (Next.js cache TTL = forever, per-file). Bij wijzigingen aan de .md → redeploy nodig.
 */
const loadTemplate = unstable_cache(
  async (type: LegalType) => {
    const filePath = path.join(process.cwd(), 'src/lib/legal', TEMPLATE_FILE[type])
    return readFile(filePath, 'utf-8')
  },
  ['legal-template'],
  { revalidate: false },
)

/**
 * Render legal-template met portaal-naam substitutie. `{{tenantName}}` →
 * tenantName (bijv. "DelftseBanen"). Gebruikt voor /voorwaarden en /privacy
 * wanneer de tenant geen eigen override-tekst heeft.
 */
export async function renderLegalTemplate(
  type: LegalType,
  tenantName: string,
): Promise<string> {
  const template = await loadTemplate(type)
  return template.replaceAll('{{tenantName}}', tenantName)
}
