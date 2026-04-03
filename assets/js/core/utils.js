const tokenPattern = /(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+|gho_[A-Za-z0-9]+|ghu_[A-Za-z0-9]+|ghs_[A-Za-z0-9]+)/g

export const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  const digits = value >= 100 || index === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[index]}`
}

export const formatDateTime = (input) => {
  if (!input) return '—'
  const date = typeof input === 'number' ? new Date(input) : new Date(Number(input) * 1000 || input)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const sanitizeText = (value) => String(value ?? '').replace(tokenPattern, '[token]')

export const normalizePath = (input = '', { trimLeading = true, trimTrailing = false } = {}) => {
  let value = String(input ?? '').replace(/\\/g, '/').replace(/\/+/g, '/').trim()
  if (trimLeading) value = value.replace(/^\/+/, '')
  if (trimTrailing) value = value.replace(/\/+$/, '')
  return value
}

export const ensureDirectoryPath = (input = '') => {
  const value = normalizePath(input, { trimLeading: true, trimTrailing: true })
  return value ? `${value}/` : ''
}

export const joinPath = (...parts) => {
  const filtered = parts
    .flatMap((part) => String(part ?? '').split('/'))
    .map((part) => part.trim())
    .filter(Boolean)
  return filtered.join('/')
}

export const uniqueBy = (items, keyFactory) => {
  const map = new Map()
  for (const item of items) map.set(keyFactory(item), item)
  return Array.from(map.values())
}

export const toBase64 = (arrayBuffer) => {
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

export const fileToBase64 = async (file) => toBase64(await file.arrayBuffer())

export const pool = async (items, limit, worker) => {
  const results = new Array(items.length)
  let cursor = 0
  const size = Math.max(1, Number(limit) || 1)

  const run = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()))
  return results
}

export const createQueueItems = (files, basePath = '') => {
  const prefix = ensureDirectoryPath(basePath)
  const prepared = files.map((file) => {
    const relative = normalizePath(file.webkitRelativePath || file.name, { trimLeading: true, trimTrailing: false })
    const repositoryPath = normalizePath(`${prefix}${relative}`, { trimLeading: true, trimTrailing: false })
    return {
      id: `${repositoryPath}:${file.size}:${file.lastModified}`,
      name: file.name,
      path: repositoryPath,
      relativePath: relative,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file
    }
  })
  return uniqueBy(prepared, (item) => item.path)
}

export const detectQueueWarnings = (items) => {
  const warnings = []
  if (!items.length) return warnings
  const heavy = items.filter((item) => item.size > 50 * 1024 * 1024)
  if (heavy.length) warnings.push(`${heavy.length} file(s) exceed 50 MB. Large objects can be slow and are better handled with Git LFS.`)
  const total = items.reduce((sum, item) => sum + item.size, 0)
  if (total > 250 * 1024 * 1024) warnings.push(`Total selection size is ${formatBytes(total)}. Consider splitting very large commits.`)
  return warnings
}

export const parseAcceptedPermissions = (value) => {
  if (!value) return []
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export const stringifyError = (error) => {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return sanitizeText(error)
  if (error instanceof Error) return sanitizeText(error.message)
  return sanitizeText(JSON.stringify(error))
}
