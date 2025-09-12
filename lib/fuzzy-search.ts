/**
 * Simple fuzzy search implementation
 * Scores based on:
 * - Exact match (highest score)
 * - Starts with query
 * - Contains query
 * - Character proximity
 */

export interface FuzzySearchOptions {
  threshold?: number // 0.0 = exact match, 1.0 = match anything
  keys?: string[] // Object keys to search in
}

export interface FuzzySearchResult<T> {
  item: T
  score: number
}

function calculateScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()
  
  // Exact match
  if (lowerText === lowerQuery) return 1.0
  
  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return 0.9
  
  // Contains query as substring
  if (lowerText.includes(lowerQuery)) return 0.7
  
  // Fuzzy character matching
  let score = 0
  let queryIndex = 0
  let lastMatchIndex = -1
  
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      // Bonus for consecutive matches
      const distance = lastMatchIndex === -1 ? 0 : i - lastMatchIndex
      score += 1 / (1 + distance * 0.1)
      lastMatchIndex = i
      queryIndex++
    }
  }
  
  // All query characters found
  if (queryIndex === lowerQuery.length) {
    return Math.min(0.6, score / lowerQuery.length)
  }
  
  return 0
}

export function fuzzySearch<T>(
  items: T[],
  query: string,
  options: FuzzySearchOptions = {}
): FuzzySearchResult<T>[] {
  const { threshold = 0.3, keys = [] } = options
  
  if (!query || query.trim() === '') {
    return items.map(item => ({ item, score: 1 }))
  }
  
  const results: FuzzySearchResult<T>[] = []
  
  for (const item of items) {
    let maxScore = 0
    
    if (keys.length > 0 && typeof item === 'object' && item !== null) {
      // Search in specified keys
      for (const key of keys) {
        const value = (item as any)[key]
        if (typeof value === 'string') {
          const score = calculateScore(query, value)
          maxScore = Math.max(maxScore, score)
        }
      }
    } else if (typeof item === 'string') {
      // Direct string search
      maxScore = calculateScore(query, item)
    }
    
    if (maxScore >= threshold) {
      results.push({ item, score: maxScore })
    }
  }
  
  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score)
}