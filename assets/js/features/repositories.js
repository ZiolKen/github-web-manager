import { show, text } from '../core/dom.js'
import { explainGitHubError } from '../core/github.js'

const renderResult = (element, payload, visible = true) => {
  show(element, visible)
  if (!visible) return
  element.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
}

export const initRepositoriesFeature = ({ store, client, logger, nodes }) => {
  nodes.createRepoButton.addEventListener('click', async () => {
    const name = nodes.createRepoName.value.trim()
    if (!name) {
      window.alert('Repository name is required.')
      return
    }

    const payload = {
      name,
      private: nodes.createRepoVisibility.value === 'private',
      description: nodes.createRepoDescription.value.trim(),
      homepage: nodes.createRepoHomepage.value.trim(),
      gitignore_template: nodes.createRepoGitignore.value.trim() || undefined,
      license_template: nodes.createRepoLicense.value.trim() || undefined,
      auto_init: nodes.createRepoAutoInit.checked
    }

    try {
      const response = await client.createRepository(payload)
      const repo = response.data
      store.update((state) => {
        state.workspace.owner = repo.owner.login
        state.workspace.repo = repo.name
        state.workspace.defaultBranch = repo.default_branch || ''
        state.workspace.branch = repo.default_branch || state.workspace.branch
        state.workspace.repoData = repo
      })
      renderResult(nodes.createRepoResult, {
        full_name: repo.full_name,
        html_url: repo.html_url,
        private: repo.private,
        default_branch: repo.default_branch
      })
      logger.success('Created repository', repo.full_name)
    } catch (error) {
      logger.error('Failed to create repository', error.message)
      renderResult(nodes.createRepoResult, explainGitHubError(error))
    }
  })

  nodes.deleteRepoButton.addEventListener('click', async () => {
    const owner = nodes.deleteRepoOwner.value.trim()
    const repo = nodes.deleteRepoName.value.trim()
    const confirmation = nodes.deleteRepoConfirmation.value.trim()

    if (!owner || !repo) {
      window.alert('Owner and repository are required.')
      return
    }

    if (confirmation !== `${owner}/${repo}`) {
      window.alert('Confirmation text does not match owner/repository.')
      return
    }

    try {
      await client.deleteRepository(owner, repo)
      renderResult(nodes.deleteRepoResult, `Deleted ${owner}/${repo}`)
      logger.success('Deleted repository', `${owner}/${repo}`)

      const workspace = store.getState().workspace
      if (workspace.owner === owner && workspace.repo === repo) {
        store.update((state) => {
          state.workspace.repo = ''
          state.workspace.repoData = null
          state.workspace.defaultBranch = ''
          state.workspace.branch = ''
          state.workspace.branches = []
        })
      }
    } catch (error) {
      logger.error('Failed to delete repository', error.message)
      renderResult(nodes.deleteRepoResult, explainGitHubError(error))
    }
  })

  store.subscribe((state) => {
    const workspace = state.workspace
    text(nodes.overviewUser, state.session.user?.login || '—')
    text(nodes.overviewRepo, workspace.repoData?.full_name || [workspace.owner, workspace.repo].filter(Boolean).join('/') || '—')
    text(nodes.overviewBranch, workspace.branch || '—')
    text(nodes.overviewQueue, `${state.runtime.queue.length} file${state.runtime.queue.length === 1 ? '' : 's'}`)
  })
}
