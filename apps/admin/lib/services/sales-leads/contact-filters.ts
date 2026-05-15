/**
 * Detecteer placeholder-namen die Mistral soms uit generieke /contact- of
 * info-pagina's haalt wanneer er geen echte personen op staan. Deze records
 * zijn onbruikbaar voor Pipedrive-person creation en verspillen credits in
 * Apollo /people/match.
 *
 * Match-strategie: lowercase + trim. Exact match tegen een conservative
 * lijst, plus 'afdeling X' prefix (zoals "Afdeling Personeelszaken" — uit
 * CLAUDE.md project-context).
 *
 * Bewust conservatief: we filteren niet op losse achternamen die ook een
 * functie kunnen zijn ("Sales", "Marketing") om false positives te voorkomen.
 */
const PLACEHOLDER_NAMES = new Set<string>([
  'niet gespecificeerd',
  'niet bekend',
  'niet ingevuld',
  'onbekend',
  'unknown',
  'n/a',
  'na',
  'info',
  'contact',
  'klantenservice',
  'customer service',
  'support',
  'hr',
  'human resources',
  'p&o',
  'p en o',
  'personeelszaken',
  'directie',
  'receptie',
])

export function isPlaceholderContactName(name: string | undefined | null): boolean {
  if (!name) return true
  const norm = name.trim().toLowerCase()
  if (norm.length < 2) return true
  if (PLACEHOLDER_NAMES.has(norm)) return true
  // Prefix-detectie voor zinsnede-achtige placeholders die Mistral fabriceert
  // wanneer er geen echte persoonsnaam op de pagina staat:
  //   "Niet vermeld", "Niet expliciet genoemd", "Niet ingevuld" → "niet ..."
  //   "Geen contact bekend", "Geen naam vermeld" → "geen ..."
  //   "Afdeling Personeelszaken", "Afdeling Sales" → "afdeling ..."
  // Echte NL achternamen die met "niet"/"geen" beginnen (bv. "Nietzsche")
  // hebben geen spatie na het prefix, dus geen false positive.
  if (norm.startsWith('afdeling ')) return true
  if (norm.startsWith('niet ')) return true
  if (norm.startsWith('geen ')) return true
  return false
}
