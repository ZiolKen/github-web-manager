import { parseAcceptedPermissions, sanitizeText, sleep } from './utils.js'

export class GitHubError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'GitHubError'
    Object.assign(this, details)
  }
}

export class GitHubClient {
  constructor(store, logger) {
    this.store = store
    this.logger = logger
  }

  get session() {
    return this.store.getState().session
  }

  async request(path, { method = 'GET', body, headers = {}, attempts = 2 } = {}) {
    const url = `${this.session.apiBase}${path}`
    const requestHeaders = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...headers
    }

    if (this.session.token) {
      requestHeaders.Authorization = `Bearer ${this.session.token}`
    }

    if (body !== undefined) {
      requestHeaders['Content-Type'] = 'application/json'
    }

    let lastError = null

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body)
        })

        const responseHeaders = {
          acceptedPermissions: response.headers.get('x-accepted-github-permissions') || '',
          oauthScopes: response.headers.get('x-oauth-scopes') || '',
          rateLimitLimit: response.headers.get('x-ratelimit-limit') || '',
          rateLimitRemaining: response.headers.get('x-ratelimit-remaining') || '',
          rateLimitReset: response.headers.get('x-ratelimit-reset') || '',
          retryAfter: response.headers.get('retry-after') || ''
        }

        this.store.update((state) => {
          state.runtime.api = {
            acceptedPermissions: responseHeaders.acceptedPermissions,
            oauthScopes: responseHeaders.oauthScopes,
            rateLimitLimit: responseHeaders.rateLimitLimit,
            rateLimitRemaining: responseHeaders.rateLimitRemaining,
            rateLimitReset: responseHeaders.rateLimitReset
          }
          if (responseHeaders.oauthScopes) {
            state.session.oauthScopes = responseHeaders.oauthScopes
          }
        })

        const text = await response.text()
        let data = null

        if (text) {
          try {
            data = JSON.parse(text)
          } catch {
            data = text
          }
        }

        if (!response.ok) {
          const message = typeof data === 'object' && data?.message ? data.message : response.statusText || 'Request failed'
          const error = new GitHubError(message, {
            status: response.status,
            data,
            acceptedPermissions: responseHeaders.acceptedPermissions,
            oauthScopes: responseHeaders.oauthScopes,
            path,
            method
          })

          const retryAfter = Number(responseHeaders.retryAfter || 0)
          const shouldRetry = attempt < attempts && (response.status === 429 || (response.status === 403 && /secondary rate limit/i.test(String(message))))
          if (shouldRetry) {
            const delay = retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt
            this.logger.warn(`Retrying ${method} ${path}`, `Attempt ${attempt} failed with ${response.status}. Waiting ${delay}ms.`)
            await sleep(delay)
            continue
          }

          throw error
        }

        return {
          status: response.status,
          data,
          headers: responseHeaders
        }
      } catch (error) {
        lastError = error
        if (attempt >= attempts || error instanceof GitHubError) break
        await sleep(600 * attempt)
      }
    }

    if (lastError instanceof GitHubError) throw lastError
    throw new GitHubError(sanitizeText(lastError?.message || 'Network error'), { cause: lastError })
  }

  async getViewer() {
    return this.request('/user')
  }

  async getRepository(owner, repo) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)
  }

  async listBranches(owner, repo) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`)
  }

  async createRepository(payload) {
    return this.request('/user/repos', { method: 'POST', body: payload })
  }

  async deleteRepository(owner, repo) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: 'DELETE' })
  }

  async getContents(owner, repo, path = '', ref = '') {
    const safePath = path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : ''
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : ''
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${safePath}${query}`)
  }

  async putContent(owner, repo, path, { message, content, branch, sha }) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: {
        message,
        content,
        branch,
        ...(sha ? { sha } : {})
      }
    })
  }

  async deleteContent(owner, repo, path, { message, sha, branch }) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'DELETE',
      body: { message, sha, branch }
    })
  }

  async getReference(owner, repo, branch) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`)
  }

  async createReference(owner, repo, branch, sha) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, {
      method: 'POST',
      body: {
        ref: `refs/heads/${branch}`,
        sha
      }
    })
  }

  async getCommit(owner, repo, sha) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(sha)}`)
  }

  async getTree(owner, repo, sha, recursive = false) {
    const query = recursive ? '?recursive=1' : ''
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(sha)}${query}`)
  }

  async createBlob(owner, repo, content) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, {
      method: 'POST',
      body: {
        content,
        encoding: 'base64'
      }
    })
  }

  async createTree(owner, repo, tree, baseTree) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`, {
      method: 'POST',
      body: {
        ...(baseTree ? { base_tree: baseTree } : {}),
        tree
      }
    })
  }

  async createCommit(owner, repo, message, treeSha, parentSha) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`, {
      method: 'POST',
      body: {
        message,
        tree: treeSha,
        parents: parentSha ? [parentSha] : []
      }
    })
  }

  async updateReference(owner, repo, branch, sha, force = false) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: {
        sha,
        force
      }
    })
  }

  async getBranch(owner, repo, branch) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`)
  }
}

export const explainGitHubError = (error) => {
  if (!error) return 'Unknown error.'
  const status = error.status ? `${error.status}` : ''
  const accepted = error.acceptedPermissions ? ` Accepted permissions: ${error.acceptedPermissions}.` : ''
  return `${error.message || 'Request failed'}${status ? ` [${status}]` : ''}.${accepted}`.trim()
}

export const ensureBranchReady = async (client, logger, workspace) => {
  const { owner, repo, branch, defaultBranch } = workspace
  try {
    await client.getReference(owner, repo, branch)
    return branch
  } catch (error) {
    if (error.status !== 404) throw error
    if (!defaultBranch || defaultBranch === branch) throw error
    const sourceRef = await client.getReference(owner, repo, defaultBranch)
    await client.createReference(owner, repo, branch, sourceRef.data.object.sha)
    logger.success(`Created branch ${branch}`, `From ${defaultBranch}`)
    return branch
  }
}
