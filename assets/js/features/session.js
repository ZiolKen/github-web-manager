import { show, text, value } from '../core/dom.js'
import { clearPersistedToken, persistSession } from '../core/storage.js'
import { explainGitHubError } from '../core/github.js'

export const initSessionFeature = ({ store, client, logger, nodes }) => {
  const applyInputState = (state) => {
    value(nodes.apiBase, state.session.apiBase)
    value(nodes.token, state.session.token)
    nodes.rememberToken.checked = Boolean(state.session.rememberToken)
    text(nodes.apiBaseBadge, state.session.apiBase || 'https://api.github.com')
    text(nodes.acceptedPermissions, state.runtime.api.acceptedPermissions || '—')
    text(nodes.oauthScopes, state.session.oauthScopes || '—')

    const user = state.session.user
    show(nodes.identityCard, Boolean(user))
    if (user) {
      nodes.identityAvatar.src = user.avatar_url
      nodes.identityAvatar.alt = user.login
      text(nodes.identityLogin, user.login)
      text(nodes.identityName, user.name || user.html_url || 'GitHub user')
      nodes.identityLink.href = user.html_url
    }
  }

  const readSessionInputs = () => ({
    apiBase: nodes.apiBase.value.trim() || 'https://api.github.com',
    token: nodes.token.value.trim(),
    rememberToken: nodes.rememberToken.checked
  })

  nodes.toggleToken.addEventListener('click', () => {
    const isPassword = nodes.token.type === 'password'
    nodes.token.type = isPassword ? 'text' : 'password'
    nodes.toggleToken.textContent = isPassword ? 'Hide' : 'Show'
  })

  nodes.connectButton.addEventListener('click', async () => {
    const nextSession = readSessionInputs()
    store.update((state) => {
      state.session.apiBase = nextSession.apiBase
      state.session.token = nextSession.token
      state.session.rememberToken = nextSession.rememberToken
    })

    try {
      const response = await client.getViewer()
      store.update((state) => {
        state.session.user = response.data
        state.session.connected = true
      })
      persistSession(store.getState().session)
      logger.success('Connected to GitHub', response.data.login)
    } catch (error) {
      store.update((state) => {
        state.session.user = null
        state.session.connected = false
      })
      logger.error('Failed to verify token', error.message)
      window.alert(explainGitHubError(error))
    }
  })

  nodes.clearTokenButton.addEventListener('click', () => {
    clearPersistedToken()
    store.update((state) => {
      state.session.token = ''
      state.session.rememberToken = false
      state.session.oauthScopes = ''
      state.session.user = null
      state.session.connected = false
    })
    value(nodes.token, '')
    nodes.rememberToken.checked = false
    logger.info('Cleared persisted token')
  })

  nodes.apiBase.addEventListener('change', () => {
    store.update((state) => {
      state.session.apiBase = nodes.apiBase.value.trim() || 'https://api.github.com'
    })
    persistSession(store.getState().session)
  })

  nodes.rememberToken.addEventListener('change', () => {
    store.update((state) => {
      state.session.rememberToken = nodes.rememberToken.checked
      state.session.token = nodes.token.value.trim()
    })
    persistSession(store.getState().session)
  })

  nodes.token.addEventListener('change', () => {
    store.update((state) => {
      state.session.token = nodes.token.value.trim()
    })
    persistSession(store.getState().session)
  })

  store.subscribe((state) => {
    applyInputState(state)
    persistSession(state.session)
  })
}
