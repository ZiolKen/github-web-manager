const keys = {
  session: 'ghm.session',
  workspace: 'ghm.workspace'
}

const safeRead = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const safeWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export const loadPersistedState = () => {
  const session = safeRead(keys.session) || {}
  const workspace = safeRead(keys.workspace) || {}
  return {
    session,
    workspace
  }
}

export const persistSession = (session) => {
  const payload = {
    apiBase: session.apiBase,
    rememberToken: session.rememberToken,
    token: session.rememberToken ? session.token : '',
    oauthScopes: session.oauthScopes || ''
  }
  safeWrite(keys.session, payload)
}

export const persistWorkspace = (workspace) => {
  const payload = {
    owner: workspace.owner,
    repo: workspace.repo,
    branch: workspace.branch
  }
  safeWrite(keys.workspace, payload)
}

export const clearPersistedToken = () => {
  const current = safeRead(keys.session) || {}
  current.token = ''
  current.rememberToken = false
  safeWrite(keys.session, current)
}
