export const createStore = (initialState) => {
  let state = structuredClone(initialState)
  const listeners = new Set()

  const emit = () => {
    for (const listener of listeners) listener(state)
  }

  return {
    getState: () => state,
    replace(nextState) {
      state = structuredClone(nextState)
      emit()
    },
    update(recipe) {
      const draft = structuredClone(state)
      recipe(draft)
      state = draft
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    }
  }
}
