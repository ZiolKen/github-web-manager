import { $, $$, show, text } from './core/dom.js'
import { GitHubClient } from './core/github.js'
import { Logger } from './core/logger.js'
import { loadPersistedState } from './core/storage.js'
import { createStore } from './core/store.js'
import { formatDateTime } from './core/utils.js'
import { initSessionFeature } from './features/session.js'
import { initWorkspaceFeature } from './features/workspace.js'
import { initRepositoriesFeature } from './features/repositories.js'
import { initUploaderFeature } from './features/uploader.js'
import { initCleanerFeature } from './features/cleaner.js'
import { initExplorerFeature } from './features/explorer.js'

const persisted = loadPersistedState()

const store = createStore({
  session: {
    apiBase: persisted.session.apiBase || 'https://api.github.com',
    token: persisted.session.token || '',
    rememberToken: Boolean(persisted.session.rememberToken),
    user: null,
    connected: false,
    oauthScopes: persisted.session.oauthScopes || ''
  },
  workspace: {
    owner: persisted.workspace.owner || '',
    repo: persisted.workspace.repo || '',
    branch: persisted.workspace.branch || '',
    defaultBranch: '',
    repoData: null,
    branches: []
  },
  runtime: {
    queue: [],
    logs: [],
    api: {
      acceptedPermissions: '',
      oauthScopes: '',
      rateLimitLimit: '',
      rateLimitRemaining: '',
      rateLimitReset: ''
    },
    cleanerPreview: {
      mode: '',
      path: '',
      items: [],
      workspaceKey: ''
    },
    explorerTree: []
  },
  ui: {
    activeTab: 'overview'
  }
})

const logger = new Logger(store)
const client = new GitHubClient(store, logger)

const nodes = {
  apiBase: $('#apiBase'),
  token: $('#token'),
  rememberToken: $('#rememberToken'),
  toggleToken: $('#toggleToken'),
  connectButton: $('#connectButton'),
  clearTokenButton: $('#clearTokenButton'),
  apiBaseBadge: $('#apiBaseBadge'),
  identityCard: $('#identityCard'),
  identityAvatar: $('#identityAvatar'),
  identityLogin: $('#identityLogin'),
  identityName: $('#identityName'),
  identityLink: $('#identityLink'),
  acceptedPermissions: $('#acceptedPermissions'),
  oauthScopes: $('#oauthScopes'),

  workspaceOwner: $('#workspaceOwner'),
  workspaceRepo: $('#workspaceRepo'),
  workspaceBranch: $('#workspaceBranch'),
  branchPicker: $('#branchPicker'),
  loadWorkspaceButton: $('#loadWorkspaceButton'),
  syncDefaultBranchButton: $('#syncDefaultBranchButton'),
  copyWorkspaceButton: $('#copyWorkspaceButton'),
  repoFullName: $('#repoFullName'),
  repoVisibility: $('#repoVisibility'),
  repoDefaultBranch: $('#repoDefaultBranch'),
  repoLink: $('#repoLink'),

  createRepoName: $('#createRepoName'),
  createRepoVisibility: $('#createRepoVisibility'),
  createRepoDescription: $('#createRepoDescription'),
  createRepoHomepage: $('#createRepoHomepage'),
  createRepoGitignore: $('#createRepoGitignore'),
  createRepoLicense: $('#createRepoLicense'),
  createRepoAutoInit: $('#createRepoAutoInit'),
  createRepoButton: $('#createRepoButton'),
  createRepoResult: $('#createRepoResult'),

  deleteRepoOwner: $('#deleteRepoOwner'),
  deleteRepoName: $('#deleteRepoName'),
  deleteRepoConfirmation: $('#deleteRepoConfirmation'),
  deleteRepoButton: $('#deleteRepoButton'),
  deleteRepoResult: $('#deleteRepoResult'),

  overviewUser: $('#overviewUser'),
  overviewRepo: $('#overviewRepo'),
  overviewBranch: $('#overviewBranch'),
  overviewQueue: $('#overviewQueue'),

  uploadBasePath: $('#uploadBasePath'),
  uploadCommitMessage: $('#uploadCommitMessage'),
  uploadConcurrency: $('#uploadConcurrency'),
  pickFilesButton: $('#pickFilesButton'),
  pickFolderButton: $('#pickFolderButton'),
  clearQueueButton: $('#clearQueueButton'),
  filesInput: $('#filesInput'),
  folderInput: $('#folderInput'),
  dropzone: $('#dropzone'),
  uploadWarnings: $('#uploadWarnings'),
  uploadButton: $('#uploadButton'),
  uploadProgress: $('#uploadProgress'),
  uploadProgressLabel: $('#uploadProgressLabel'),
  uploadProgressValue: $('#uploadProgressValue'),
  uploadProgressBar: $('#uploadProgressBar'),
  uploadProgressMessage: $('#uploadProgressMessage'),
  queueList: $('#queueList'),
  uploadCount: $('#uploadCount'),
  uploadBytes: $('#uploadBytes'),

  cleanerMode: $('#cleanerMode'),
  cleanerCommitMessage: $('#cleanerCommitMessage'),
  cleanerPath: $('#cleanerPath'),
  cleanerSafety: $('#cleanerSafety'),
  cleanerDryRunButton: $('#cleanerDryRunButton'),
  cleanerExecuteButton: $('#cleanerExecuteButton'),
  cleanerResult: $('#cleanerResult'),
  cleanerPreviewCount: $('#cleanerPreviewCount'),
  cleanerPreviewList: $('#cleanerPreviewList'),

  explorerPrefix: $('#explorerPrefix'),
  explorerLimit: $('#explorerLimit'),
  loadExplorerButton: $('#loadExplorerButton'),
  usePrefixInCleanerButton: $('#usePrefixInCleanerButton'),
  explorerStatus: $('#explorerStatus'),
  explorerStatusLabel: $('#explorerStatusLabel'),
  explorerStatusValue: $('#explorerStatusValue'),
  explorerStatusMessage: $('#explorerStatusMessage'),
  explorerList: $('#explorerList'),
  explorerCount: $('#explorerCount'),

  logOutput: $('#logOutput'),
  clearLogsButton: $('#clearLogsButton'),

  heroConnection: $('#heroConnection'),
  heroUser: $('#heroUser'),
  heroWorkspace: $('#heroWorkspace'),
  heroBranch: $('#heroBranch'),
  heroRateRemaining: $('#heroRateRemaining'),
  heroRateReset: $('#heroRateReset')
}

const tabs = $$('.tab')
const panels = $$('.tab-panel')

const applyActiveTab = (tabName) => {
  store.update((state) => {
    state.ui.activeTab = tabName
  })
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => applyActiveTab(tab.dataset.tab))
})

document.querySelector('[data-action="focus-connect"]').addEventListener('click', () => {
  document.getElementById('connect-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
})

document.querySelector('[data-action="focus-workspace"]').addEventListener('click', () => {
  document.getElementById('workspace-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
})

nodes.clearLogsButton.addEventListener('click', () => logger.clear())

initSessionFeature({ store, client, logger, nodes })
initWorkspaceFeature({ store, client, logger, nodes })
initRepositoriesFeature({ store, client, logger, nodes })
initUploaderFeature({ store, client, logger, nodes })
initCleanerFeature({ store, client, logger, nodes })
initExplorerFeature({ store, client, logger, nodes })

store.subscribe((state) => {
  tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === state.ui.activeTab))
  panels.forEach((panel) => show(panel, panel.dataset.panel === state.ui.activeTab))

  text(nodes.heroConnection, state.session.connected ? 'Connected' : 'Idle')
  text(nodes.heroUser, state.session.user?.login || 'No user')
  text(nodes.heroWorkspace, state.workspace.repoData?.full_name || [state.workspace.owner, state.workspace.repo].filter(Boolean).join('/') || 'No target')
  text(nodes.heroBranch, `Branch ${state.workspace.branch || '—'}`)

  const remaining = state.runtime.api.rateLimitRemaining
  const limit = state.runtime.api.rateLimitLimit
  text(nodes.heroRateRemaining, remaining && limit ? `${remaining}/${limit}` : '—')
  text(nodes.heroRateReset, `Reset ${formatDateTime(state.runtime.api.rateLimitReset)}`)

  const logs = state.runtime.logs
    .map((entry) => {
      const header = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`
      return entry.meta ? `${header}\n${entry.meta}` : header
    })
    .join('\n\n')

  text(nodes.logOutput, logs || 'No log entries yet.')
})

logger.info('GitHub Manager ready')
