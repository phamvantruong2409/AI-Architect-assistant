const CHUNK_SIZE = 700
const CHUNK_OVERLAP = 100

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const paragraphs = normalized.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    if (current.length + trimmed.length + 2 <= CHUNK_SIZE) {
      current = current ? `${current}\n\n${trimmed}` : trimmed
    } else {
      if (current) {
        chunks.push(current.trim())
        const words = current.split(' ')
        const overlapWords: string[] = []
        let overlapLen = 0
        for (let i = words.length - 1; i >= 0 && overlapLen < CHUNK_OVERLAP; i--) {
          overlapWords.unshift(words[i])
          overlapLen += words[i].length + 1
        }
        current = overlapWords.join(' ')
      }

      if (trimmed.length > CHUNK_SIZE) {
        const sentences = trimmed.match(/[^.!?\n]+[.!?\n]+/g) ?? [trimmed]
        for (const sentence of sentences) {
          if (current.length + sentence.length + 1 <= CHUNK_SIZE) {
            current = current ? `${current} ${sentence}` : sentence
          } else {
            if (current) chunks.push(current.trim())
            current = sentence
          }
        }
      } else {
        current = current ? `${current}\n\n${trimmed}` : trimmed
      }
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter((c) => c.length > 30)
}
