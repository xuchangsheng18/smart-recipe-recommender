'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Users, ChefHat, Heart } from 'lucide-react'
import { Recipe } from '@/types'
import { Card } from '@/components/ui'

import { userApi } from '@/lib/api'
import { useAppStore } from '@/store'

interface RecipeCardProps {
  recipe: Recipe
  onSelect?: (recipe: Recipe) => void
  className?: string
}

const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onSelect,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { user, addFavorite, removeFavorite } = useAppStore()

  // 安全防护 1：确保 favorites 是数组
  const isFavorited = Array.isArray(user?.favorites)
    ? user.favorites.some((f: any) => f?.recipeId === recipe?.id || f === recipe?.id)
    : false

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (isLoading || !recipe?.id) return
    setIsLoading(true)

    try {
      if (isFavorited) {
        await userApi.removeFavorite(recipe.id)
        removeFavorite(recipe.id)
      } else {
        await userApi.addFavorite(recipe.id)
        addFavorite(recipe.id)
      }
    } catch (error) {
      console.error("收藏操作失败:", error)
      alert("收藏操作失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  // ==========================================
  // 🌟 核心提取：将容易因为前后端类型不一致报错的字段抽离为 any，绕过 TS 严格检查
  // ==========================================
  const rawDifficulty: any = recipe?.difficulty;
  const rawTags: any = recipe?.tags;
  const rawCookingTime: any = recipe?.cookingTime;
  const rawPrepTime: any = recipe?.prepTime;

  // 🌟 安全防护 2：防数字崩溃智能转换机制
  let safeDifficulty = 'easy';

  if (rawDifficulty) {
    if (typeof rawDifficulty === 'number') {
      if (rawDifficulty <= 2) safeDifficulty = 'easy';
      else if (rawDifficulty === 3) safeDifficulty = 'medium';
      else safeDifficulty = 'hard';
    } else if (typeof rawDifficulty === 'string') {
      safeDifficulty = rawDifficulty.toLowerCase();
    }
  }

  if (!['easy', 'medium', 'hard'].includes(safeDifficulty)) {
    safeDifficulty = 'easy';
  }

  const currentDifficulty = safeDifficulty as 'easy' | 'medium' | 'hard';

  const difficultyColors = {
    easy: 'text-green-600 bg-green-100',
    medium: 'text-yellow-600 bg-yellow-100',
    hard: 'text-red-600 bg-red-100'
  }

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  }

  // 🌟 安全防护 3：强制转数字
  const totalTime = (Number(rawCookingTime) || 0) + (Number(rawPrepTime) || 0)

  // ==========================================
  // 🌟 核心修复 4：Tags 数组强力清洗（解决 TS 报错）
  // ==========================================
  let safeTags: string[] = []
  if (Array.isArray(rawTags)) {
    // 此时 rawTags 是 any，TS 不会再限制
    safeTags = rawTags.filter(t => typeof t === 'string')
  } else if (typeof rawTags === 'string') {
    // 明确定义 t: string 解决 TS7006 隐式 any 报错
    safeTags = rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
  }

  return (
    <Card
      variant="glass"
      hover
      onClick={() => onSelect?.(recipe)}
      className={`overflow-hidden cursor-pointer ${className}`}
    >
      {/* 图片区域 */}
      <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
        {recipe?.imageUrl && !imageError ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.name || '菜谱图片'}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="w-16 h-16 text-gray-400" />
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors z-10"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isFavorited ? 'text-red-500 fill-red-500' : 'text-white'
            }`}
          />
        </motion.button>

        {/* 难度标签 */}
        <div className="absolute top-3 left-3 z-10">
          <span className={`px-2 py-1 rounded-md text-xs font-bold backdrop-blur-md bg-white/90 ${difficultyColors[currentDifficulty]}`}>
            {difficultyLabels[currentDifficulty]}
          </span>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
          {recipe?.name || '未知菜谱'}
        </h3>

        <p className="text-gray-500 text-sm mb-4 line-clamp-1">
          {recipe?.description || '这道菜还没有详细描述哦~'}
        </p>

        {/* 统计信息 */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{totalTime > 0 ? `${totalTime}分钟` : '30分钟'}</span>
            </div>

            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{recipe?.servings || 2}人份</span>
            </div>
          </div>
        </div>

        {/* 标签 */}
        <div className="flex flex-wrap gap-2">
          {safeTags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-md font-medium"
            >
              {tag}
            </span>
          ))}
          {safeTags.length > 3 && (
            <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded-md">
              +{safeTags.length - 3}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

export default RecipeCard