import { sanitizeText } from './utils.js'

export class Logger {
  constructor(store, limit = 250) {
    this.store = store
    this.limit = limit
  }

  push(level, message, meta = '') {
    const timestamp = new Date().toISOString()
    const entry = {
      id: crypto.randomUUID(),
      timestamp,
      level,
      message: sanitizeText(message),
      meta: sanitizeText(meta)
    }
    this.store.update((state) => {
      state.runtime.logs.unshift(entry)
      if (state.runtime.logs.length > this.limit) {
        state.runtime.logs.length = this.limit
      }
    })
  }

  info(message, meta = '') {
    this.push('info', message, meta)
  }

  success(message, meta = '') {
    this.push('success', message, meta)
  }

  warn(message, meta = '') {
    this.push('warn', message, meta)
  }

  error(message, meta = '') {
    this.push('error', message, meta)
  }

  clear() {
    this.store.update((state) => {
      state.runtime.logs = []
    })
  }
}
