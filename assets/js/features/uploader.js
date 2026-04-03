import { button, empty, listEmpty, show, text, value } from '../core/dom.js'
import { ensureBranchReady, explainGitHubError } from '../core/github.js'
import { createQueueItems, detectQueueWarnings, fileToBase64, formatBytes, joinPath, normalizePath, pool } from '../core/utils.js'

const renderWarnings = (element, items) => {
  const warnings = detectQueueWarnings(items)
  show(element, warnings.length > 0)
  if (warnings.length) {
    element.textContent = warnings.join('\n')
  } else {
    element.textContent = ''
  }
}

const renderProgress = (nodes, label, percent, message = '') => {
  show(nodes.uploadProgress, true)
  text(nodes.uploadProgressLabel, label)
  text(nodes.uploadProgressValue, `${Math.max(0, Math.min(100, Math.round(percent)))}%`)
  nodes.uploadProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`
  text(nodes.uploadProgressMessage, message)
}

const renderQueue = (container, queue, onRemove) => {
  empty(container)
  if (!queue.length) {
    container.append(listEmpty('No files selected yet.'))
    return
  }

  for (const item of queue) {
    const row = document.createElement('article')
    row.className = 'list-item'

    const main = document.createElement('div')
    main.className = 'list-main'

    const title = document.createElement('div')
    title.className = 'list-title'
    title.textContent = item.path

    const meta = document.createElement('div')
    meta.className = 'list-meta'
    meta.textContent = `${formatBytes(item.size)} · ${item.type}`

    const actions = document.createElement('div')
    actions.className = 'list-actions'
    actions.append(button('Remove', 'tertiary'))

    actions.firstChild.addEventListener('click', () => onRemove(item.id))

    main.append(title, meta)
    row.append(main, actions)
    container.append(row)
  }
}

const queueToState = (store, nextQueue) => {
  store.update((state) => {
    state.runtime.queue = nextQueue
  })
}

const readWorkspace = (store) => {
  const workspace = store.getState().workspace
  if (!workspace.owner || !workspace.repo || !workspace.branch) {
    throw new Error('Load a repository workspace first.')
  }
  return workspace
}

const bootstrapEmptyRepository = async ({ client, logger, workspace, items, message }) => {
  const branch = workspace.defaultBranch || workspace.branch
  const [first, ...rest] = items
  const content = await fileToBase64(first.file)
  await client.putContent(workspace.owner, workspace.repo, first.path, {
    message,
    content,
    branch
  })
  logger.success('Initialized empty repository', first.path)
  return {
    bootstrappedBranch: branch,
    remaining: rest
  }
}

const uploadWithTreeApi = async ({ client, logger, workspace, items, message, concurrency, onProgress }) => {
  const activeBranch = await ensureBranchReady(client, logger, workspace)
  const refResponse = await client.getReference(workspace.owner, workspace.repo, activeBranch)
  const headSha = refResponse.data.object.sha
  const commitResponse = await client.getCommit(workspace.owner, workspace.repo, headSha)
  const baseTreeSha = commitResponse.data.tree.sha

  let completed = 0

  const blobs = await pool(items, concurrency, async (item) => {
    const content = await fileToBase64(item.file)
    const response = await client.createBlob(workspace.owner, workspace.repo, content)
    completed += 1
    onProgress(completed, items.length, item.path)
    return {
      path: item.path,
      mode: '100644',
      type: 'blob',
      sha: response.data.sha
    }
  })

  const treeResponse = await client.createTree(workspace.owner, workspace.repo, blobs, baseTreeSha)
  const nextCommit = await client.createCommit(workspace.owner, workspace.repo, message, treeResponse.data.sha, headSha)
  await client.updateReference(workspace.owner, workspace.repo, activeBranch, nextCommit.data.sha)
  logger.success('Committed upload', `${items.length} file(s) to ${workspace.owner}/${workspace.repo}@${activeBranch}`)
}

export const initUploaderFeature = ({ store, client, logger, nodes }) => {
  const syncCounters = (queue) => {
    const count = queue.length
    const bytes = queue.reduce((sum, item) => sum + item.size, 0)
    text(nodes.uploadCount, `${count}`)
    text(nodes.uploadBytes, formatBytes(bytes))
  }

  const setQueue = (files) => {
    const basePath = nodes.uploadBasePath.value.trim()
    const incoming = createQueueItems(files, basePath)
    const current = store.getState().runtime.queue
    const merged = new Map(current.map((item) => [item.path, item]))
    for (const item of incoming) merged.set(item.path, item)
    queueToState(store, Array.from(merged.values()).sort((a, b) => a.path.localeCompare(b.path)))
  }

  const readFiles = (fileList) => Array.from(fileList || []).filter(Boolean)

  const resetProgress = () => {
    renderProgress(nodes, 'Idle', 0, '')
    show(nodes.uploadProgress, false)
  }

  const performUpload = async () => {
    const queue = store.getState().runtime.queue
    if (!queue.length) {
      window.alert('Select at least one file.')
      return
    }

    let workspace
    try {
      workspace = readWorkspace(store)
    } catch (error) {
      window.alert(error.message)
      return
    }

    const message = nodes.uploadCommitMessage.value.trim() || 'Upload via GitHub Manager'
    const concurrency = Number(nodes.uploadConcurrency.value) || 4
    const items = [...queue]
    let activeWorkspace = { ...workspace }

    try {
      renderProgress(nodes, 'Preparing upload', 4, 'Checking branch state')
      try {
        await ensureBranchReady(client, logger, activeWorkspace)
      } catch (error) {
        if (error.status !== 409) throw error
        const requestedBranch = activeWorkspace.branch
        const boot = await bootstrapEmptyRepository({
          client,
          logger,
          workspace: activeWorkspace,
          items,
          message
        })
        activeWorkspace = {
          ...activeWorkspace,
          branch: boot.bootstrappedBranch,
          defaultBranch: boot.bootstrappedBranch
        }
        if (requestedBranch && requestedBranch !== boot.bootstrappedBranch) {
          const source = await client.getReference(activeWorkspace.owner, activeWorkspace.repo, boot.bootstrappedBranch)
          await client.createReference(activeWorkspace.owner, activeWorkspace.repo, requestedBranch, source.data.object.sha)
          activeWorkspace = {
            ...activeWorkspace,
            branch: requestedBranch
          }
          logger.success('Created requested branch after bootstrap', requestedBranch)
        }
        items.splice(0, items.length, ...boot.remaining)
      }

      if (!items.length) {
        renderProgress(nodes, 'Upload complete', 100, 'Repository initialized and committed.')
        logger.success('Upload complete', 'Bootstrapped empty repository')
        return
      }

      renderProgress(nodes, 'Uploading blobs', 12, `${items.length} file(s) queued`)
      await uploadWithTreeApi({
        client,
        logger,
        workspace: activeWorkspace,
        items,
        message,
        concurrency,
        onProgress: (done, total, path) => {
          const percent = 12 + (done / Math.max(1, total)) * 76
          renderProgress(nodes, 'Uploading blobs', percent, `${done}/${total} · ${path}`)
        }
      })

      renderProgress(nodes, 'Upload complete', 100, `Committed ${items.length} file(s).`)
      logger.success('Upload complete', `${items.length} file(s) committed`)
    } catch (error) {
      renderProgress(nodes, 'Upload failed', 100, explainGitHubError(error))
      logger.error('Upload failed', error.message)
      window.alert(explainGitHubError(error))
    }
  }

  nodes.pickFilesButton.addEventListener('click', () => nodes.filesInput.click())
  nodes.pickFolderButton.addEventListener('click', () => nodes.folderInput.click())
  nodes.clearQueueButton.addEventListener('click', () => queueToState(store, []))

  nodes.filesInput.addEventListener('change', () => {
    setQueue(readFiles(nodes.filesInput.files))
    nodes.filesInput.value = ''
  })

  nodes.folderInput.addEventListener('change', () => {
    setQueue(readFiles(nodes.folderInput.files))
    nodes.folderInput.value = ''
  })

  nodes.dropzone.addEventListener('click', () => nodes.filesInput.click())
  nodes.dropzone.addEventListener('dragenter', () => nodes.dropzone.classList.add('is-dragging'))
  nodes.dropzone.addEventListener('dragover', (event) => {
    event.preventDefault()
    nodes.dropzone.classList.add('is-dragging')
  })
  nodes.dropzone.addEventListener('dragleave', () => nodes.dropzone.classList.remove('is-dragging'))
  nodes.dropzone.addEventListener('drop', (event) => {
    event.preventDefault()
    nodes.dropzone.classList.remove('is-dragging')
    setQueue(readFiles(event.dataTransfer?.files))
  })

  nodes.uploadBasePath.addEventListener('change', () => {
    const queue = store.getState().runtime.queue
    if (!queue.length) return
    const files = queue.map((item) => item.file)
    queueToState(store, createQueueItems(files, nodes.uploadBasePath.value.trim()))
  })

  nodes.uploadButton.addEventListener('click', performUpload)

  store.subscribe((state) => {
    const queue = state.runtime.queue
    syncCounters(queue)
    renderWarnings(nodes.uploadWarnings, queue)
    renderQueue(nodes.queueList, queue, (id) => {
      queueToState(store, store.getState().runtime.queue.filter((item) => item.id !== id))
    })
  })

  resetProgress()
}
