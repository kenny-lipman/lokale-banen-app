/**
 * Eerste 2 digits SBI → Pipedrive Branche enum-id.
 * Pipedrive enum-velden:
 *   53 = Automotive
 *   54 = Bouw + gerelateerd
 *   55 = Detailhandel, groothandel en ambachten
 *   56 = Horeca
 *   57 = Industrie / productie
 *   58 = ICT / Software / Tech
 *   59 = Logistiek / Transport
 *   60 = Onderwijs
 *   61 = Zorg & Welzijn
 *   62 = Zakelijke dienstverlening
 *   63 = Overheid / NGO
 *   64 = Financieel / Verzekeringen
 *   65 = Vastgoed
 *   66 = Media / Communicatie
 *   99 = Overig
 *
 * Bij conflict KvK SBI ↔ Apollo `industry`: Apollo wint voor master_record (sales-relevanter).
 * KvK SBI komt in deal-notitie + UI-warning.
 */
export const SBI_TO_BRANCHE_ID: Record<string, number> = {
  // 01-03: landbouw, bosbouw, visserij
  '01': 99, '02': 99, '03': 99,
  // 05-09: delfstoffen
  '05': 57, '06': 57, '07': 57, '08': 57, '09': 57,
  // 10-33: industrie / productie
  '10': 57, '11': 57, '12': 57, '13': 57, '14': 57, '15': 57, '16': 57, '17': 57,
  '18': 57, '19': 57, '20': 57, '21': 57, '22': 57, '23': 57, '24': 57, '25': 57,
  '26': 57, '27': 57, '28': 57, '29': 57, '30': 57, '31': 57, '32': 57, '33': 57,
  // 35-39: nutsbedrijven / afval
  '35': 57, '36': 57, '37': 57, '38': 57, '39': 57,
  // 41-43: bouw
  '41': 54, '42': 54, '43': 54,
  // 45: autohandel
  '45': 53,
  // 46-47: handel
  '46': 55, '47': 55,
  // 49-53: vervoer en opslag
  '49': 59, '50': 59, '51': 59, '52': 59, '53': 59,
  // 55-56: horeca
  '55': 56, '56': 56,
  // 58-63: informatie en communicatie
  '58': 66, '59': 66, '60': 66, '61': 58, '62': 58, '63': 58,
  // 64-66: financieel
  '64': 64, '65': 64, '66': 64,
  // 68: vastgoed
  '68': 65,
  // 69-75: zakelijke dienstverlening
  '69': 62, '70': 62, '71': 62, '72': 62, '73': 62, '74': 62, '75': 62,
  // 77-82: facilitair / verhuur
  '77': 62, '78': 62, '79': 62, '80': 62, '81': 62, '82': 62,
  // 84: openbaar bestuur
  '84': 63,
  // 85: onderwijs
  '85': 60,
  // 86-88: zorg en welzijn
  '86': 61, '87': 61, '88': 61,
  // 90-93: cultuur / sport
  '90': 99, '91': 99, '92': 99, '93': 99,
  // 94-96: overige diensten
  '94': 99, '95': 99, '96': 99,
  // 97-99: huishoudens / extraterritoriaal
  '97': 99, '98': 99, '99': 99,
}

/**
 * Map een SBI-code (bv "70221") → Pipedrive Branche enum-id.
 * Pakt eerste 2 digits, valt terug op 99 (Overig) bij onbekend.
 */
export function sbiToBrancheId(sbiCode: string): number {
  const prefix = sbiCode.slice(0, 2)
  return SBI_TO_BRANCHE_ID[prefix] ?? 99
}

/**
 * Map een SBI-code → leesbare branche-label (voor UI/notitie).
 */
export const BRANCHE_ID_TO_LABEL: Record<number, string> = {
  53: 'Automotive',
  54: 'Bouw + gerelateerd',
  55: 'Detailhandel, groothandel en ambachten',
  56: 'Horeca',
  57: 'Industrie / productie',
  58: 'ICT / Software / Tech',
  59: 'Logistiek / Transport',
  60: 'Onderwijs',
  61: 'Zorg & Welzijn',
  62: 'Zakelijke dienstverlening',
  63: 'Overheid / NGO',
  64: 'Financieel / Verzekeringen',
  65: 'Vastgoed',
  66: 'Media / Communicatie',
  99: 'Overig',
}

export function sbiToBrancheLabel(sbiCode: string): string {
  return BRANCHE_ID_TO_LABEL[sbiToBrancheId(sbiCode)]
}
