'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AppState, UserPreferences, ChatSession, Recipe, Timer, Toast } from '@/types'

interface AppStore extends AppState {
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void
  addFavorite: (recipeId: string) => void
  removeFavorite: (recipeId: string) => void
  addRating: (recipeId: string, rating: number, review?: string) => void

  createChatSession: (title?: string) => string
  switchChatSession: (sessionId: string) => void
  deleteChatSession: (sessionId: string) => void
  updateSessionTitle: (sessionId: string, title: string) => void
  addMessage: (sessionId: string, message: Omit<ChatSession['messages'][0], 'id' | 'timestamp'>) => string

  // 🌟 核心修改：支持对象 payload 更新
  updateMessage: (sessionId: string, messageId: string, payload: string | Record<string, any>) => void

  setChatLoading: (loading: boolean) => void
  setChatStreaming: (streaming: boolean) => void

  setCurrentRecipe: (recipe: Recipe | null) => void
  setSearchResults: (results: AppState['recipes']['searchResults']) => void
  addRecentRecipe: (recipe: Recipe) => void
  setRecipesLoading: (loading: boolean) => void

  startCooking: (recipe: Recipe) => void
  stopCooking: () => void
  setCurrentStep: (step: number) => void
  completeStep: (stepId: string) => void
  uncompleteStep: (stepId: string) => void
  addTimer: (timer: Omit<Timer, 'id'>) => string
  updateTimer: (timerId: string, updates: Partial<Timer>) => void
  removeTimer: (timerId: string) => void

  setTheme: (theme: 'light' | 'dark') => void
  setSidebarOpen: (open: boolean) => void
  setModalOpen: (open: boolean) => void
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (toastId: string) => void
  clearToasts: () => void
}

const initialUserPreferences: UserPreferences = {
  dietaryRestrictions: [],
  allergies: [],
  favoriteCuisines: [],
  dislikedIngredients: [],
  spiceLevel: 'medium',
  cookingSkill: 'intermediate',
  mealTypes: [],
  budgetRange: 'medium'
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      user: {
        preferences: initialUserPreferences,
        favorites: [],
        ratings: []
      },
      chat: {
        currentSession: null,
        sessions: [],
        isLoading: false,
        isStreaming: false
      },
      recipes: {
        currentRecipe: null,
        searchResults: null,
        recentRecipes: [],
        isLoading: false
      },
      cooking: {
        activeRecipe: null,
        currentStep: 0,
        timers: [],
        completedSteps: []
      },
      ui: {
        theme: 'light',
        sidebarOpen: false,
        modalOpen: false,
        toasts: []
      },

      updateUserPreferences: (preferences) =>
        set((state) => ({
          user: {
            ...state.user,
            preferences: { ...state.user.preferences, ...preferences }
          }
        })),

      addFavorite: (recipeId) =>
        set((state) => {
          const exists = state.user.favorites.some(f => f.recipeId === recipeId)
          if (exists) return state

          return {
            user: {
              ...state.user,
              favorites: [
                ...state.user.favorites,
                { recipeId, createdAt: new Date() }
              ]
            }
          }
        }),

      removeFavorite: (recipeId) =>
        set((state) => ({
          user: {
            ...state.user,
            favorites: state.user.favorites.filter(f => f.recipeId !== recipeId)
          }
        })),

      addRating: (recipeId, rating, review) =>
        set((state) => {
          const existingIndex = state.user.ratings.findIndex(r => r.recipeId === recipeId)
          const newRating = { recipeId, rating, review, createdAt: new Date() }

          if (existingIndex >= 0) {
            const newRatings = [...state.user.ratings]
            newRatings[existingIndex] = newRating
            return {
              user: { ...state.user, ratings: newRatings }
            }
          } else {
            return {
              user: {
                ...state.user,
                ratings: [...state.user.ratings, newRating]
              }
            }
          }
        }),

      createChatSession: (title) => {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const newSession: ChatSession = {
          id: sessionId,
          title: title || '新对话',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }

        set((state) => ({
          chat: {
            ...state.chat,
            sessions: [newSession, ...state.chat.sessions],
            currentSession: newSession
          }
        }))

        return sessionId
      },

      switchChatSession: (sessionId) =>
        set((state) => {
          const session = state.chat.sessions.find(s => s.id === sessionId)
          return {
            chat: { ...state.chat, currentSession: session || null }
          }
        }),

      deleteChatSession: (sessionId) =>
        set((state) => {
          const newSessions = state.chat.sessions.filter(s => s.id !== sessionId)
          const currentSession = state.chat.currentSession?.id === sessionId
            ? (newSessions[0] || null)
            : state.chat.currentSession

          return {
            chat: {
              ...state.chat,
              sessions: newSessions,
              currentSession
            }
          }
        }),

      updateSessionTitle: (sessionId, title) =>
        set((state) => {
          const sessionIndex = state.chat.sessions.findIndex(s => s.id === sessionId)
          if (sessionIndex === -1) return state

          const newSessions = [...state.chat.sessions]
          newSessions[sessionIndex] = {
            ...newSessions[sessionIndex],
            title,
            updatedAt: new Date()
          }

          return {
            chat: {
              ...state.chat,
              sessions: newSessions,
              currentSession: state.chat.currentSession?.id === sessionId
                ? newSessions[sessionIndex]
                : state.chat.currentSession
            }
          }
        }),

      addMessage: (sessionId, messageData) => {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const message = {
          ...messageData,
          id: messageId,
          timestamp: new Date()
        }

        set((state) => {
          const sessionIndex = state.chat.sessions.findIndex(s => s.id === sessionId)
          if (sessionIndex === -1) return state

          const newSessions = [...state.chat.sessions]
          newSessions[sessionIndex] = {
            ...newSessions[sessionIndex],
            messages: [...newSessions[sessionIndex].messages, message],
            updatedAt: new Date()
          }

          return {
            chat: {
              ...state.chat,
              sessions: newSessions,
              currentSession: state.chat.currentSession?.id === sessionId
                ? newSessions[sessionIndex]
                : state.chat.currentSession
            }
          }
        })

        return messageId
      },

      // ==========================================
      // 🌟 核心修复 2：彻底修好合并逻辑和 TypeScript 语法错误
      // ==========================================
      updateMessage: (sessionId, messageId, payload) =>
        set((state) => {
          const sessionIndex = state.chat.sessions.findIndex(s => s.id === sessionId)
          if (sessionIndex === -1) return state

          const session = state.chat.sessions[sessionIndex]
          const messageIndex = session.messages.findIndex(m => m.id === messageId)
          if (messageIndex === -1) return state

          const newSessions = [...state.chat.sessions]
          const newMessages = [...session.messages]

          if (typeof payload === 'string') {
            // 纯文本打字机模式下，只更新 content
            newMessages[messageIndex] = {
              ...newMessages[messageIndex],
              content: payload
            }
          } else {
            // 如果传来的是卡片对象，做兼容清洗
            const safePayload = { ...payload }
            if (safePayload.recipes && Array.isArray(safePayload.recipes)) {
              safePayload.recipes = safePayload.recipes.map((recipe: any) => {
                let safeDifficulty = recipe.difficulty
                // 修复了之前的 elif 报错，改用标准 else if
                if (typeof safeDifficulty === 'number') {
                  if (safeDifficulty <= 2) safeDifficulty = 'easy'
                  else if (safeDifficulty === 3) safeDifficulty = 'medium'
                  else safeDifficulty = 'hard'
                }
                return {
                  ...recipe,
                  difficulty: safeDifficulty || 'easy'
                }
              })

              // 同步写入 metadata，完美迎合各种展示逻辑
              safePayload.metadata = {
                ...(newMessages[messageIndex].metadata || {}),
                recipes: safePayload.recipes
              }
            }

            // 对象属性层级浅合并
            newMessages[messageIndex] = {
              ...newMessages[messageIndex],
              ...safePayload
            }
          }

          newSessions[sessionIndex] = {
            ...session,
            messages: newMessages,
            updatedAt: new Date()
          }

          return {
            chat: {
              ...state.chat,
              sessions: newSessions,
              currentSession: state.chat.currentSession?.id === sessionId
                ? newSessions[sessionIndex]
                : state.chat.currentSession
            }
          }
        }),

      setChatLoading: (loading) =>
        set((state) => ({
          chat: { ...state.chat, isLoading: loading }
        })),

      setChatStreaming: (streaming) =>
        set((state) => ({
          chat: { ...state.chat, isStreaming: streaming }
        })),

      setCurrentRecipe: (recipe) =>
        set((state) => ({
          recipes: { ...state.recipes, currentRecipe: recipe }
        })),

      setSearchResults: (results) =>
        set((state) => ({
          recipes: { ...state.recipes, searchResults: results }
        })),

      addRecentRecipe: (recipe) =>
        set((state) => {
          const filtered = state.recipes.recentRecipes.filter(r => r.id !== recipe.id)
          return {
            recipes: {
              ...state.recipes,
              recentRecipes: [recipe, ...filtered].slice(0, 10)
            }
          }
        }),

      setRecipesLoading: (loading) =>
        set((state) => ({
          recipes: { ...state.recipes, isLoading: loading }
        })),

      startCooking: (recipe) =>
        set((state) => ({
          cooking: {
            ...state.cooking,
            activeRecipe: recipe,
            currentStep: 0,
            completedSteps: []
          }
        })),

      stopCooking: () =>
        set((state) => ({
          cooking: {
            ...state.cooking,
            activeRecipe: null,
            currentStep: 0,
            completedSteps: [],
            timers: []
          }
        })),

      setCurrentStep: (step) =>
        set((state) => ({
          cooking: { ...state.cooking, currentStep: step }
        })),

      completeStep: (stepId) =>
        set((state) => ({
          cooking: {
            ...state.cooking,
            completedSteps: [...state.cooking.completedSteps, stepId]
          }
        })),

      uncompleteStep: (stepId) =>
        set((state) => ({
          cooking: {
            ...state.cooking,
            completedSteps: state.cooking.completedSteps.filter(id => id !== stepId)
          }
        })),

      addTimer: (timerData) => {
        const timerId = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const timer = { ...timerData, id: timerId }

        set((state) => ({
          cooking: {
            ...state.cooking,
            timers: [...state.cooking.timers, timer]
          }
        }))

        return timerId
      },

      updateTimer: (timerId, updates) =>
        set((state) => {
          const timerIndex = state.cooking.timers.findIndex(t => t.id === timerId)
          if (timerIndex === -1) return state

          const newTimers = [...state.cooking.timers]
          newTimers[timerIndex] = { ...newTimers[timerIndex], ...updates }

          return {
            cooking: { ...state.cooking, timers: newTimers }
          }
        }),

      removeTimer: (timerId) =>
        set((state) => ({
          cooking: {
            ...state.cooking,
            timers: state.cooking.timers.filter(t => t.id !== timerId)
          }
        })),

      setTheme: (theme) =>
        set((state) => ({
          ui: { ...state.ui, theme }
        })),

      setSidebarOpen: (open) =>
        set((state) => ({
          ui: { ...state.ui, sidebarOpen: open }
        })),

      setModalOpen: (open) =>
        set((state) => ({
          ui: { ...state.ui, modalOpen: open }
        })),

      addToast: (toastData) => {
        const toastId = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const toast = { ...toastData, id: toastId }

        set((state) => ({
          ui: {
            ...state.ui,
            toasts: [...(Array.isArray(state.ui.toasts) ? state.ui.toasts : []), toast]
          }
        }))

        return toastId
      },

      removeToast: (toastId) =>
        set((state) => ({
          ui: {
            ...state.ui,
            toasts: (Array.isArray(state.ui.toasts) ? state.ui.toasts : []).filter(t => t.id !== toastId)
          }
        })),

      clearToasts: () =>
        set((state) => ({
          ui: { ...state.ui, toasts: [] }
        }))
    }),
    {
      name: 'what-to-eat-today-store',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        user: state.user,
        chat: {
          sessions: state.chat.sessions,
          currentSession: state.chat.currentSession
        },
        recipes: {
          recentRecipes: state.recipes.recentRecipes
        },
        ui: {
          theme: state.ui.theme
        }
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (!Array.isArray(state.ui.toasts)) {
            state.ui.toasts = []
          }

          const safeDate = (dateValue: any) => {
            if (!dateValue) return new Date()
            if (dateValue instanceof Date) return dateValue
            try {
              const date = new Date(dateValue)
              return isNaN(date.getTime()) ? new Date() : date
            } catch {
              return new Date()
            }
          }

          if (state.chat.currentSession) {
            state.chat.currentSession.createdAt = safeDate(state.chat.currentSession.createdAt)
            state.chat.currentSession.updatedAt = safeDate(state.chat.currentSession.updatedAt)

            if (state.chat.currentSession.messages) {
              state.chat.currentSession.messages = state.chat.currentSession.messages.map(msg => ({
                ...msg,
                timestamp: safeDate(msg.timestamp)
              }))
            }
          }

          if (state.chat.sessions && Array.isArray(state.chat.sessions)) {
            state.chat.sessions = state.chat.sessions.map(session => ({
              ...session,
              createdAt: safeDate(session.createdAt),
              updatedAt: safeDate(session.updatedAt),
              messages: session.messages ? session.messages.map(msg => ({
                ...msg,
                timestamp: safeDate(msg.timestamp)
              })) : []
            }))
          }
        }
      }
    }
  )
)