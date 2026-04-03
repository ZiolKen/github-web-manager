import { option, text, value } from '../core/dom.js'
import { explainGitHubError } from '../core/github.js'
import { persistWorkspace } from '../core/storage.js'

export const initWorkspaceFeature = ({ store, client, logger, nodes }) => {
  const getInputs = () => ({
    owner: nodes.workspaceOwner.value.trim(),
    repo: nodes.workspaceRepo.value.trim(),
    branch: nodes.workspaceBranch.value.trim()
  })

  const populateBranches = (branches, selected) => {
    nodes.branchPicker.innerHTML = ''
    if (!branches.length) {
      nodes.branchPicker.append(option('', 'Load a repository first'))
      return
    }
    for (const branch of branches) {
      nodes.branchPicker.append(option(branch.name, branch.name))
    }
    nodes.branchPicker.value = selected || branches[0]?.name || ''
  }

  const render = (state) => {
    const workspace = state.workspace
    value(nodes.workspaceOwner, workspace.owner)
    value(nodes.workspaceRepo, workspace.repo)
    value(nodes.workspaceBranch, workspace.branch)

    populateBranches(workspace.branches, workspace.branch)

    text(nodes.repoFullName, workspace.repoData?.full_name || '—')
    text(nodes.repoVisibility, workspace.repoData?.private ? 'Private' : workspace.repoData ? 'Public' : '—')
    text(nodes.repoDefaultBranch, workspace.defaultBranch || '—')
    nodes.repoLink.href = workspace.repoData?.html_url || '#'
  }

  nodes.loadWorkspaceButton.addEventListener('click', async () => {
    const input = getInputs()
    if (!input.owner || !input.repo) {
      window.alert('Owner and repository are required.')
      return
    }

    store.update((state) => {
      state.workspace.owner = input.owner
      state.workspace.repo = input.repo
      state.workspace.branch = input.branch
    })

    try {
      const [repoResponse, branchesResponse] = await Promise.all([
        client.getRepository(input.owner, input.repo),
        client.listBranches(input.owner, input.repo)
      ])

      const repoData = repoResponse.data
      const branches = branchesResponse.data || []
      const candidateBranch = input.branch || repoData.default_branch
      const activeBranch = branches.some((item) => item.name === candidateBranch)
        ? candidateBranch
        : repoData.default_branch || branches[0]?.name || ''

      store.update((state) => {
        state.workspace.owner = input.owner
        state.workspace.repo = input.repo
        state.workspace.branch = activeBranch
        state.workspace.defaultBranch = repoData.default_branch || ''
        state.workspace.repoData = repoData
        state.workspace.branches = branches
      })

      persistWorkspace(store.getState().workspace)
      logger.success('Loaded repository workspace', repoData.full_name)
    } catch (error) {
      logger.error('Failed to load repository', error.message)
      window.alert(explainGitHubError(error))
    }
  })

  nodes.branchPicker.addEventListener('change', () => {
    store.update((state) => {
      state.workspace.branch = nodes.branchPicker.value
    })
    persistWorkspace(store.getState().workspace)
  })

  nodes.syncDefaultBranchButton.addEventListener('click', () => {
    const defaultBranch = store.getState().workspace.defaultBranch
    if (!defaultBranch) return
    store.update((state) => {
      state.workspace.branch = defaultBranch
    })
    persistWorkspace(store.getState().workspace)
  })

  nodes.copyWorkspaceButton.addEventListener('click', async () => {
    const workspace = store.getState().workspace
    const payload = [workspace.owner, workspace.repo].filter(Boolean).join('/')
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
      logger.success('Copied workspace', payload)
    } catch {
      logger.warn('Clipboard access failed')
    }
  })

  nodes.workspaceOwner.addEventListener('change', () => {
    store.update((state) => {
      state.workspace.owner = nodes.workspaceOwner.value.trim()
    })
    persistWorkspace(store.getState().workspace)
  })

  nodes.workspaceRepo.addEventListener('change', () => {
    store.update((state) => {
      state.workspace.repo = nodes.workspaceRepo.value.trim()
    })
    persistWorkspace(store.getState().workspace)
  })

  nodes.workspaceBranch.addEventListener('change', () => {
    store.update((state) => {
      state.workspace.branch = nodes.workspaceBranch.value.trim()
    })
    persistWorkspace(store.getState().workspace)
  })

  store.subscribe((state) => {
    render(state)
    persistWorkspace(state.workspace)
  })
}

