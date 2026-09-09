export const MAX_JSON_FILE_BYTES = 2 * 1024 * 1024

export type ReadJsonFileResult =
  | { status: 'ok'; text: string }
  | { status: 'invalid'; text: string; error: string }
  | { status: 'reject'; error: string }

export type JsonSide = 'Left' | 'Right'

function looksLikeJsonFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) return true
  const type = file.type.toLowerCase()
  return type === 'application/json' || type.endsWith('+json')
}

export async function readJsonFile(file: File, side: JsonSide): Promise<ReadJsonFileResult> {
  if (file.size > MAX_JSON_FILE_BYTES) {
    return { status: 'reject', error: `${side} JSON file is too large (max 2MB).` }
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    return { status: 'reject', error: `${side} JSON file could not be read.` }
  }

  try {
    JSON.parse(text)
    return { status: 'ok', text }
  } catch {
    if (looksLikeJsonFile(file)) {
      return {
        status: 'invalid',
        text,
        error: `${side} JSON is invalid — fix the highlighted error before comparing.`,
      }
    }
    return {
      status: 'reject',
      error: `${side} file is not JSON. Choose a .json file or a file whose contents are valid JSON.`,
    }
  }
}
