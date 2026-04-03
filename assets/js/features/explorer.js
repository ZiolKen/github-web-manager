import { button, empty, listEmpty, text, show } from '../core/dom.js'
import { explainGitHubError } from '../core/github.js'
import { normalizePath } from '../core/utils.js'

const getWorkspace = (store) => {
  const workspace = store.getState().workspace
  if (!workspace.owner || !workspace.repo || !workspace.branch) throw new Error('Load a repository workspace first.')
  return workspace
}

const renderStatus = (nodes, visible, label = '', value = '', message = '') => {
  show(nodes.explorerStatus, visible)
  text(nodes.explorerStatusLabel, label)
  text(nodes.explorerStatusValue, value)
  text(nodes.explorerStatusMessage, message)
}

const renderList = (container, items, onCleanerPath) => {
  empty(container)
  if (!items.length) {
    container.append(listEmpty('No items match the current filter.'))
    return
  }

  for (const item of items) {
    const row = document.createElement('article')
    row.className = 'list-item'

    const main = document.createElement('div')
    main.className = 'list-main'

    const title = document.createElement('div')
    title.className = 'list-title'
    title.textContent = item.path

    const meta = document.createElement('div')
    meta.className = 'list-meta'
    meta.textContent = `${item.type} · ${item.sha?.slice(0, 10) || '—'}${item.size ? ` · ${item.size} bytes` : ''}`

    const actions = document.createElement('div')
    actions.className = 'list-actions'

    const useButton = button('Use in cleaner', 'tertiary')
    useButton.addEventListener('click', () => {
      const nextPath = item.type === 'tree' ? `${item.path}/` : item.path
      onCleanerPath(nextPath)
    })

    const copyButton = button('Copy path', 'tertiary')
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.path)
      } catch {}
    })

    actions.append(useButton, copyButton)
    main.append(title, meta)
    row.append(main, actions)
    container.append(row)
  }
}

export const initExplorerFeature = ({ store, client, logger, nodes }) => {
  const loadTree = async () => {
    let workspace
    try {
      workspace = getWorkspace(store)
    } catch (error) {
      window.alert(error.message)
      return
    }

    try {
      renderStatus(nodes, true, 'Loading tree', '…', 'Fetching repository tree')
      const ref = await client.getReference(workspace.owner, workspace.repo, workspace.branch)
      const commit = await client.getCommit(workspace.owner, workspace.repo, ref.data.object.sha)
      const tree = await client.getTree(workspace.owner, workspace.repo, commit.data.tree.sha, true)

      store.update((state) => {
        state.runtime.explorerTree = tree.data.tree || []
      })

      renderStatus(nodes, true, 'Tree loaded', `${(tree.data.tree || []).length}`, `Branch ${workspace.branch}`)
      logger.success('Loaded explorer tree', `${(tree.data.tree || []).length} item(s)`)
    } catch (error) {
      renderStatus(nodes, true, 'Tree load failed', '0', explainGitHubError(error))
      logger.error('Explorer load failed', error.message)
    }
  }

  const render = (state) => {
    const prefix = normalizePath(nodes.explorerPrefix.value, { trimLeading: true, trimTrailing: true })
    const limit = Number(nodes.explorerLimit.value) || 100
    const filtered = state.runtime.explorerTree
      .filter((item) => prefix ? item.path === prefix || item.path.startsWith(`${prefix}/`) : true)
      .slice(0, limit)

    text(nodes.explorerCount, `${filtered.length}`)
    renderList(nodes.explorerList, filtered, (path) => {
      nodes.cleanerPath.value = path
      nodes.cleanerMode.value = path.endsWith('/') ? 'folder-tree' : 'file'
    })
  }

  nodes.loadExplorerButton.addEventListener('click', loadTree)
  nodes.explorerPrefix.addEventListener('input', () => render(store.getState()))
  nodes.explorerLimit.addEventListener('change', () => render(store.getState()))
  nodes.usePrefixInCleanerButton.addEventListener('click', () => {
    const prefix = normalizePath(nodes.explorerPrefix.value, { trimLeading: true, trimTrailing: true })
    if (!prefix) return
    nodes.cleanerPath.value = `${prefix}/`
    nodes.cleanerMode.value = 'folder-tree'
  })

  store.subscribe((state) => render(state))
}
