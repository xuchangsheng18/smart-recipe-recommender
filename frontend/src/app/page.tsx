'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Search, Heart, ChefHat, Sparkles, X } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { RecipeCard } from '@/components/recipe'
import { useAppStore } from '@/store'
import { useRecipes } from '@/hooks'
import { Recipe } from '@/types'
import { useRouter } from 'next/navigation'
import { userApi } from '@/lib/api'

const HomePage: React.FC = () => {
  const router = useRouter()
  const { createChatSession, ui, setSidebarOpen } = useAppStore()

  const { getRecommendations, searchRecipes, searchResults, isLoading: isSearchLoading } = useRecipes()

  const [recommendations, setRecommendations] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarType, setSidebarType] = useState<'search' | 'favorites' | null>(null)

  const [searchQuery, setSearchQuery] = useState('')

  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false)

  // ==========================================
  // 🌟 核心修复区：精准解构后端的嵌套 JSON 数据
  // ==========================================
  const searchArray = React.useMemo<any[] | null>(() => {
    if (!searchResults) return null; // 还没搜索过
    if (Array.isArray(searchResults)) return searchResults; // 如果直接是数组，直接用

    const res = searchResults as any;

    // 1. 适配最新后端的嵌套格式: { success: true, data: { items: [...] } }
    if (res.data && Array.isArray(res.data.items)) {
      return res.data.items;
    }

    // 2. 适配常见的扁平格式或直接返回 data 数组的情况
    if (res.data && Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.recipes)) return res.recipes;
    if (Array.isArray(res.results)) return res.results;

    return []; // 如果什么都没找到，返回空数组触发“未找到”提示
  }, [searchResults]);

  const loadRecommendations = async () => {
    setIsLoading(true)
    try {
      const recs = await getRecommendations()
      setRecommendations(recs.slice(0, 3))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRecommendations()
  }, [getRecommendations])

  useEffect(() => {
    if (ui.sidebarOpen && sidebarType === 'favorites') {
      const fetchFavorites = async () => {
        setIsLoadingFavorites(true)
        try {
          const response = await userApi.getFavorites()
          if (response.success && response.data) {
            setFavoriteRecipes(response.data)
          }
        } catch (error) {
          console.error('获取收藏失败:', error)
        } finally {
          setIsLoadingFavorites(false)
        }
      }
      fetchFavorites()
    }
  }, [ui.sidebarOpen, sidebarType])

  const handleStartChat = () => {
    const sessionId = createChatSession('今天吃什么？')
    window.location.href = `/chat?session=${sessionId}`
  }

  const executeSearch = () => {
    if (searchQuery.trim()) {
      searchRecipes(searchQuery.trim());
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  }

  const quickQuestions = [
    '今天晚餐吃什么好？',
    '有什么简单易做的家常菜？',
    '适合减肥的低卡菜谱',
    '30分钟内能做完的菜',
    '适合新手的烘焙食谱',
    '下饭的家常菜推荐'
  ]

  const handleOpenSidebar = (type: 'search' | 'favorites') => {
    setSidebarType(type)
    setSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    setSidebarOpen(false)
    setSidebarType(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <AnimatePresence>
        {ui.sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={handleCloseSidebar}
            />

            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed left-0 top-0 h-full w-80 glass border-r border-white/20 z-50 flex flex-col"
            >
              <div className="p-4 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {sidebarType === 'search' ? (
                      <>
                        <Search className="w-6 h-6 text-blue-500" />
                        <h2 className="text-lg font-semibold gradient-text">搜索菜谱</h2>
                      </>
                    ) : (
                      <>
                        <Heart className="w-6 h-6 text-red-500" />
                        <h2 className="text-lg font-semibold gradient-text">我的收藏</h2>
                      </>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCloseSidebar}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {sidebarType === 'search' ? (
                  <div className="space-y-4 flex flex-col h-full">

                    <div className="shrink-0 relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="输入菜名，按回车或点击搜索..."
                        className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={executeSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Search className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex-1 pb-10 mt-4">
                      {isSearchLoading && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                          <p>正在努力搜索中...</p>
                        </div>
                      )}

                      {!isSearchLoading && searchArray && searchArray.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <span className="text-4xl mb-3 block">🔍</span>
                          <p>抱歉，没有找到相关菜谱</p>
                          <p className="text-xs mt-1">换个关键词试试看吧</p>
                        </div>
                      )}

                      {!isSearchLoading && searchArray && searchArray.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500 mb-2">找到 {searchArray.length} 个结果</p>
                          {searchArray.map((recipe: any) => (
                            <motion.div
                              key={recipe.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              onClick={() => window.location.href = `/recipe/${recipe.id}`}
                              className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all flex items-center space-x-3"
                            >
                              <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                <img
                                  src={recipe.imageUrl || `https://via.placeholder.com/150?text=${recipe.name}`}
                                  alt={recipe.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 line-clamp-1">{recipe.name}</h4>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                  {recipe.description || '美味菜谱，点击查看详情'}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {!isSearchLoading && !searchArray && (
                        <div className="text-gray-400 text-center py-12">
                          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>输入你想吃的菜，点击搜索按钮</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isLoadingFavorites ? (
                      <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        正在加载收藏...
                      </div>
                    ) : favoriteRecipes.length > 0 ? (
                      favoriteRecipes.map((recipe) => (
                        <motion.div
                          key={recipe.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => window.location.href = `/recipe/${recipe.id}`}
                          className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 cursor-pointer transition-all flex items-center space-x-3"
                        >
                          <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                            <img
                              src={recipe.imageUrl || `https://via.placeholder.com/150?text=${recipe.name}`}
                              alt={recipe.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-800 line-clamp-1">{recipe.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              ⏱️ {recipe.cookingTime || 30} 分钟
                            </p>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-center py-12">
                        <Heart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>暂无收藏的菜谱</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <nav className="glass border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">今天吃什么</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => handleOpenSidebar('search')}>
                <Search className="w-4 h-4 mr-2" />
                搜索
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleOpenSidebar('favorites')}>
                <Heart className="w-4 h-4 mr-2" />
                收藏
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold gradient-text mb-6"
            >
              今天吃什么？
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-gray-600 mb-8"
            >
              AI美食助手为您推荐个性化菜谱，提供详细烹饪指导
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button variant="primary" size="lg" onClick={handleStartChat} className="text-lg px-8 py-4">
                <MessageCircle className="w-5 h-5 mr-2" />
                开始对话
              </Button>
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            💡 快速开始
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickQuestions.map((question, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <Card
                  variant="glass"
                  hover
                  onClick={() => {
                    const sessionId = createChatSession(question)
                    window.location.href = `/chat?session=${sessionId}&q=${encodeURIComponent(question)}`
                  }}
                  className="cursor-pointer h-full flex items-center justify-center"
                >
                  <div className="p-4 w-full text-center">
                    <p className="text-gray-700 leading-relaxed">{question}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {recommendations.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-16"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                <Heart className="w-6 h-6 text-red-500 mr-2" />
                为您推荐
              </h2>
              <Button variant="ghost" onClick={() => loadRecommendations()} disabled={isLoading}>
                换一批
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + index * 0.1 }}
                >
                  <RecipeCard
                    recipe={recipe}
                    onSelect={(recipe) => {
                      window.location.href = `/recipe/${recipe.id}`
                    }}
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </main>
    </div>
  )
}

export default HomePage