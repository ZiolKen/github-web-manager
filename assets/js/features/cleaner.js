import { button, empty, listEmpty, show, text } from '../core/dom.js'
import { ensureBranchReady, explainGitHubError } from '../core/github.js'
import { formatBytes, normalizePath } from '../core/utils.js'

const renderResult = (element, message) => {
  show(element, Boolean(message))
  element.textContent = message || ''
}

const renderPreview = (container, preview, onUse) => {
  empty(container)
  if (!preview.items.length) {
    container.append(listEmpty('Run a dry-run to preview affected paths.'))
    return
  }

  for (const item of preview.items.slice(0, 120)) {
    const row = document.createElement('article')
    row.className = 'list-item'

    const main = document.createElement('div')
    main.className = 'list-main'

    const title = document.createElement('div')
    title.className = 'list-title'
    title.textContent = item.path

    const meta = document.createElement('div')
    meta.className = 'list-meta'
    meta.textContent = item.sha ? `sha ${item.sha.slice(0, 10)}…` : item.type || 'path'

    const actions = document.createElement('div')
    actions.className = 'list-actions'
    const useButton = button('Use path', 'tertiary')
    useButton.addEventListener('click', () => onUse(item.path))
    actions.append(useButton)

    main.append(title, meta)
    row.append(main, actions)
    container.append(row)
  }

  if (preview.items.length > 120) {
    const tail = document.createElement('div')
    tail.className = 'subtle'
    tail.textContent = `Showing the first 120 of ${preview.items.length} items.`
    container.append(tail)
  }
}

const getWorkspace = (store) => {
  const workspace = store.getState().workspace
  if (!workspace.owner || !workspace.repo || !workspace.branch) throw new Error('Load a repository workspace first.')
  return workspace
}

const listFilesViaContents = async (client, workspace, folderPath) => {
  const items = []
  const walk = async (path) => {
    const response = await client.getContents(workspace.owner, workspace.repo, path, workspace.branch)
    if (!Array.isArray(response.data)) throw new Error(`${path} is not a directory.`)
    for (const entry of response.data) {
      if (entry.type === 'dir') {
        await walk(entry.path)
      } else if (entry.type === 'file') {
        items.push({ path: entry.path, sha: entry.sha, type: 'file' })
      }
    }
  }
  await walk(folderPath)
  return items
}

const listFilesViaTree = async (client, workspace, folderPath) => {
  const ref = await client.getReference(workspace.owner, workspace.repo, workspace.branch)
  const commit = await client.getCommit(workspace.owner, workspace.repo, ref.data.object.sha)
  const tree = await client.getTree(workspace.owner, workspace.repo, commit.data.tree.sha, true)
  const prefix = normalizePath(folderPath, { trimLeading: true, trimTrailing: true })
  const folderPrefix = prefix ? `${prefix}/` : ''
  return (tree.data.tree || [])
    .filter((entry) => entry.type === 'blob' && entry.path.startsWith(folderPrefix))
    .map((entry) => ({ path: entry.path, sha: entry.sha, type: 'file' }))
}

const createDeletePreview = async (client, workspace, mode, inputPath) => {
  const path = normalizePath(inputPath, { trimLeading: true, trimTrailing: mode === 'file' ? false : true })
  if (!path) throw new Error('Path is required.')

  if (mode === 'file') {
    const response = await client.getContents(workspace.owner, workspace.repo, path, workspace.branch)
    if (Array.isArray(response.data)) throw new Error('Path points to a directory. Switch cleaner mode.')
    return {
      mode,
      path,
      items: [{ path, sha: response.data.sha, type: 'file' }]
    }
  }

  const items = mode === 'folder-contents'
    ? await listFilesViaContents(client, workspace, path)
    : await listFilesViaTree(client, workspace, path)

  return { mode, path, items }
}

const deleteViaContents = async (client, workspace, items, message) => {
  for (const item of items) {
    await client.deleteContent(workspace.owner, workspace.repo, item.path, {
      message,
      sha: item.sha,
      branch: workspace.branch
    })
  }
}

const deleteViaTree = async (client, workspace, items, message) => {
  const activeBranch = await ensureBranchReady(client, { success() {}, warn() {} }, workspace)
  const ref = await client.getReference(workspace.owner, workspace.repo, activeBranch)
  const headSha = ref.data.object.sha
  const commit = await client.getCommit(workspace.owner, workspace.repo, headSha)
  const tree = items.map((item) => ({
    path: item.path,
    mode: '100644',
    type: 'blob',
    sha: null
  }))
  const nextTree = await client.createTree(workspace.owner, workspace.repo, tree, commit.data.tree.sha)
  const nextCommit = await client.createCommit(workspace.owner, workspace.repo, message, nextTree.data.sha, headSha)
  await client.updateReference(workspace.owner, workspace.repo, activeBranch, nextCommit.data.sha)
}

export const initCleanerFeature = ({ store, client, logger, nodes }) => {
  const syncPreview = (preview) => {
    text(nodes.cleanerPreviewCount, `${preview.items.length} item${preview.items.length === 1 ? '' : 's'}`)
    renderPreview(nodes.cleanerPreviewList, preview, (path) => {
      nodes.cleanerPath.value = path
    })
  }

  nodes.cleanerDryRunButton.addEventListener('click', async () => {
    let workspace
    try {
      workspace = getWorkspace(store)
    } catch (error) {
      window.alert(error.message)
      return
    }

    const mode = nodes.cleanerMode.value
    const inputPath = nodes.cleanerPath.value

    try {
      const preview = await createDeletePreview(client, workspace, mode, inputPath)
      store.update((state) => {
        state.runtime.cleanerPreview = {
          ...preview,
          workspaceKey: `${workspace.owner}/${workspace.repo}@${workspace.branch}`
        }
      })
      renderResult(nodes.cleanerResult, `${preview.items.length} item(s) would be removed.`)
      logger.success('Cleaner dry-run complete', `${preview.items.length} item(s)`)
    } catch (error) {
      renderResult(nodes.cleanerResult, explainGitHubError(error))
      logger.error('Cleaner dry-run failed', error.message)
    }
  })

  nodes.cleanerExecuteButton.addEventListener('click', async () => {
    if (!nodes.cleanerSafety.checked) {
      window.alert('Enable the safety switch before deleting.')
      return
    }

    let workspace
    try {
      workspace = getWorkspace(store)
    } catch (error) {
      window.alert(error.message)
      return
    }

    const preview = store.getState().runtime.cleanerPreview
    const expectedKey = `${workspace.owner}/${workspace.repo}@${workspace.branch}`
    const currentMode = nodes.cleanerMode.value
    const currentPath = normalizePath(nodes.cleanerPath.value, { trimLeading: true, trimTrailing: currentMode === 'file' ? false : true })

    if (!preview.items.length || preview.workspaceKey !== expectedKey || preview.mode !== currentMode || preview.path !== currentPath) {
      window.alert('Run a fresh dry-run for the current path before deleting.')
      return
    }

    const message = nodes.cleanerCommitMessage.value.trim() || 'Delete via GitHub Manager'

    try {
      if (preview.mode === 'folder-tree') {
        await deleteViaTree(client, workspace, preview.items, message)
      } else {
        await deleteViaContents(client, workspace, preview.items, message)
      }

      renderResult(nodes.cleanerResult, `Deleted ${preview.items.length} item(s).`)
      logger.success('Cleaner execution complete', `${preview.items.length} item(s) deleted`)
      store.update((state) => {
        state.runtime.cleanerPreview = {
          mode: '',
          path: '',
          items: [],
          workspaceKey: ''
        }
      })
    } catch (error) {
      renderResult(nodes.cleanerResult, explainGitHubError(error))
      logger.error('Cleaner execution failed', error.message)
    }
  })

  store.subscribe((state) => {
    syncPreview(state.runtime.cleanerPreview)
  })
}
