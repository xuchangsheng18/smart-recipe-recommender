'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ShoppingCart, Plus, Minus } from 'lucide-react'
import { Ingredient } from '@/types'
import { Card, Button } from '@/components/ui'

interface IngredientListProps {
  ingredients: Ingredient[]
  servings?: number
  originalServings?: number
  onServingsChange?: (servings: number) => void
  onIngredientToggle?: (ingredientId: string, checked: boolean) => void
  showShoppingList?: boolean
  className?: string
}

const IngredientList: React.FC<IngredientListProps> = ({
  ingredients,
  servings = 1,
  originalServings = 1,
  onServingsChange,
  onIngredientToggle,
  showShoppingList = false,
  className = ''
}) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set())
  
  const handleIngredientToggle = (uniqueKey: string) => {
    const newChecked = new Set(checkedIngredients)
    const isChecked = !newChecked.has(uniqueKey)

    if (isChecked) {
      newChecked.add(uniqueKey)
    } else {
      newChecked.delete(uniqueKey)
    }

    setCheckedIngredients(newChecked)
    onIngredientToggle?.(uniqueKey, isChecked)
  }

  const calculateAmount = (ingredient: Ingredient) => {
    const rawAmount = ingredient.amount || ''
    if (!rawAmount) return ''

    // 使用正则分离数字和汉字/英文字母单位 (如 "30ml" -> "30" 和 "ml")
    const match = rawAmount.match(/^([0-9.]+)\s*(.*)$/)

    // 如果没有匹配到数字（比如用量写的是"少许", "适量"），则原样返回
    if (!match || isNaN(parseFloat(match[1]))) {
      return rawAmount
    }

    const originalNumber = parseFloat(match[1])
    const unit = match[2] || ingredient.unit || '' // 兼容原来的 unit 字段
    const ratio = servings / originalServings
    const newAmount = originalNumber * ratio

    // 格式化数量显示
    let formattedNumber
    if (newAmount < 1) {
      formattedNumber = newAmount.toFixed(2).replace(/\.?0+$/, '')
    } else if (newAmount % 1 === 0) {
      formattedNumber = newAmount.toString()
    } else {
      formattedNumber = newAmount.toFixed(1).replace(/\.0$/, '')
    }

    return `${formattedNumber} ${unit}`.trim()
  }

  const groupedIngredients = ingredients.reduce((groups, ingredient) => {
    const category = ingredient.category || '默认清单'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(ingredient)
    return groups
  }, {} as Record<string, Ingredient[]>)

  return (
    <Card variant="glass" className={className}>
      <div className="p-6">
        {/* 标题和份数调节 */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2" />
            食材清单
          </h3>

          {onServingsChange && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">份数:</span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onServingsChange(Math.max(1, servings - 1))}
                  disabled={servings <= 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>

                <span className="w-8 text-center font-medium">{servings}</span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onServingsChange(servings + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 食材列表 */}
        <div className="space-y-6">
          {Object.entries(groupedIngredients).map(([category, categoryIngredients]) => (
            <div key={category}>
              {category !== '默认清单' && (
                <h4 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
                  {category}
                </h4>
              )}

              <div className="space-y-2">
                <AnimatePresence>
                  {categoryIngredients.map((ingredient, index) => {
                    // 兼容修复：如果没有 id，就用 name 或 index 作为唯一标识
                    const uniqueKey = ingredient.id || ingredient.name || `item-${index}`
                    const isChecked = checkedIngredients.has(uniqueKey)

                    return (
                      <motion.div
                        key={uniqueKey}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="ingredient-item py-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center flex-1">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleIngredientToggle(uniqueKey)}
                            className={`relative w-5 h-5 rounded border-2 transition-all duration-200 flex-shrink-0 ${
                              isChecked
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            <AnimatePresence>
                              {isChecked && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0 }}
                                  className="absolute inset-0 flex items-center justify-center"
                                >
                                  <Check className="w-3 h-3 text-white" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>

                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-medium transition-all duration-200 ${
                                  isChecked
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-800'
                                }`}
                              >
                                {ingredient.name}
                              </span>

                              <span className={`text-sm ${isChecked ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                                {calculateAmount(ingredient)}
                              </span>
                            </div>

                            {ingredient.alternatives && ingredient.alternatives.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                可替代: {ingredient.alternatives.join(', ')}
                              </p>
                            )}
                          </div>

                          {ingredient.isOptional && (
                            <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              可选
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>

        {/* 统计信息 */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              已准备 {checkedIngredients.size} / {ingredients.length} 项食材
            </span>

            {showShoppingList && checkedIngredients.size > 0 && (
              <Button variant="ghost" size="sm" className="text-blue-600">
                添加到购物清单
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default IngredientList