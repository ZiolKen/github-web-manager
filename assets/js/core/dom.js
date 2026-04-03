export const $ = (selector, root = document) => root.querySelector(selector)

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector))

export const show = (element, visible = true) => {
  if (!element) return
  element.classList.toggle('is-hidden', !visible)
}

export const text = (element, value = '') => {
  if (!element) return
  element.textContent = value ?? ''
}

export const value = (element, nextValue = '') => {
  if (!element) return
  element.value = nextValue ?? ''
}

export const option = (valueText, labelText) => {
  const node = document.createElement('option')
  node.value = valueText
  node.textContent = labelText
  return node
}

export const empty = (element) => {
  if (!element) return
  while (element.firstChild) element.removeChild(element.firstChild)
}

export const button = (label, variant = 'tertiary', attributes = {}) => {
  const node = document.createElement('button')
  node.type = 'button'
  node.className = `button ${variant}`
  node.textContent = label
  Object.entries(attributes).forEach(([key, val]) => node.setAttribute(key, val))
  return node
}

export const listEmpty = (message) => {
  const node = document.createElement('div')
  node.className = 'list-empty'
  node.textContent = message
  return node
}
