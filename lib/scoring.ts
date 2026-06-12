import type { Quiz, ScoreResult } from '@/types'

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]/g, '')
    .replace(/[・]/g, '')
    // katakana → hiragana
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function trigramJaccard(a: string, b: string): number {
  const trigrams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3))
    return set
  }
  const sa = trigrams(a), sb = trigrams(b)
  let intersection = 0
  sa.forEach((t) => { if (sb.has(t)) intersection++ })
  const union = sa.size + sb.size - intersection
  return union === 0 ? 0 : intersection / union
}

// Find best-matching substring of `haystack` against `needle`
function bestSubstringSimilarity(haystack: string, needle: string): { similarity: number; matched: string } {
  if (haystack.includes(needle)) return { similarity: 1, matched: needle }
  if (needle.length === 0) return { similarity: 0, matched: '' }

  let best = 0
  let bestStr = ''
  const len = needle.length

  for (let start = 0; start <= haystack.length - Math.floor(len * 0.5); start++) {
    for (let end = start + Math.floor(len * 0.5); end <= Math.min(start + len * 2, haystack.length); end++) {
      const sub = haystack.slice(start, end)
      const editSim = 1 - levenshtein(sub, needle) / Math.max(sub.length, needle.length)
      const tgSim = trigramJaccard(sub, needle)
      const sim = Math.max(editSim, tgSim)
      if (sim > best) { best = sim; bestStr = sub }
    }
  }
  return { similarity: best, matched: bestStr }
}

function extractNumbers(text: string): Array<{ value: number; unit: string }> {
  const patterns = [
    /([0-9,，.．]+)\s*(km|m|cm|mm|kg|g|t|リットル|ℓ|L|メートル|キロ|センチ|キログラム|トン)/gi,
  ]
  const results: Array<{ value: number; unit: string }> = []
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1].replace(/[,，]/g, '')
      const value = parseFloat(raw)
      const unit = match[2].toLowerCase()
      if (!isNaN(value)) results.push({ value, unit })
    }
  }
  return results
}

function normalizeToMeters(value: number, unit: string): number {
  const u = unit.toLowerCase()
  if (u === 'km' || u === 'キロ') return value * 1000
  if (u === 'cm' || u === 'センチ') return value / 100
  if (u === 'mm') return value / 1000
  return value  // m, メートル
}

export function scoreAnswer(quiz: Quiz, ocrText: string, elapsedSeconds: number): ScoreResult {
  const normalized = normalize(ocrText)

  if (quiz.type === 'number' && quiz.answerNumber !== undefined) {
    const candidates = extractNumbers(ocrText)
    const correct = normalizeToMeters(quiz.answerNumber, quiz.answerUnit ?? 'm')

    let bestError = 1
    let bestValue = 0
    for (const c of candidates) {
      const normalized_val = normalizeToMeters(c.value, c.unit)
      const relError = Math.abs(normalized_val - correct) / correct
      if (relError < bestError) { bestError = relError; bestValue = c.value }
    }

    const similarity = Math.max(0, 1 - bestError / 0.1)  // 10% error → 0 score
    const isCorrect = similarity >= 0.85
    const baseScore = Math.round(similarity * 100)
    const timeBonus = isCorrect ? Math.round((1 - elapsedSeconds / quiz.timeLimitSeconds) * 20) : 0
    return {
      ocrText,
      similarity,
      isCorrect,
      baseScore,
      timeBonus: Math.max(0, timeBonus),
      totalScore: baseScore + Math.max(0, timeBonus),
      timeToAnswer: elapsedSeconds,
      answerFound: bestValue > 0 ? `${bestValue}` : '',
    }
  }

  // text type
  const candidates = [
    quiz.answerText ?? '',
    ...(quiz.answerAliases ?? []),
  ].filter(Boolean).map(normalize)

  let best = { similarity: 0, matched: '' }
  for (const candidate of candidates) {
    const r = bestSubstringSimilarity(normalized, candidate)
    if (r.similarity > best.similarity) best = r
  }

  const isCorrect = best.similarity >= 0.85
  const baseScore = Math.round(best.similarity * 100)
  const timeBonus = isCorrect ? Math.round((1 - elapsedSeconds / quiz.timeLimitSeconds) * 20) : 0
  return {
    ocrText,
    similarity: best.similarity,
    isCorrect,
    baseScore,
    timeBonus: Math.max(0, timeBonus),
    totalScore: baseScore + Math.max(0, timeBonus),
    timeToAnswer: elapsedSeconds,
    answerFound: best.matched,
  }
}
