'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Play, Pause, RotateCcw,
  Check, ChevronRight, ChevronLeft, Timer, ChefHat,
  Heart, Star, X
} from 'lucide-react'

// 🌟 引入我们封装好的统一 API
import { recipeApi, userApi } from '@/lib/api'

export default function CookingModePage() {
  const params = useParams()
  const router = useRouter()
  const recipeId = params.id as string

  // --- 状态管理 ---
  const [recipe, setRecipe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // 互动状态：收藏与完成评分
  const [isFavorited, setIsFavorited] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [rating, setRating] = useState(0)

  // 倒计时状态
  const [timer, setTimer] = useState<{remaining: number, isRunning: boolean, initial: number} | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // --- 1. 获取数据 ---
  useEffect(() => {
    const fetchRecipe = async () => {
      setLoading(true)
      try {
        // 🌟 使用封装好的 API 方法，自动走代理处理跨域
        const result = await recipeApi.getRecipe(recipeId)

        if (result.success && result.data) {
          setRecipe(result.data)
          // 如果后端详情里带了 isFavorited 字段，可以在这里初始化
          // setIsFavorited(result.data.isFavorited || false)
        } else {
          setRecipe(null)
        }
      } catch (error) {
        console.error("获取菜谱失败:", error)
        setRecipe(null)
      } finally {
        setLoading(false)
      }
    }

    if (recipeId) fetchRecipe()
  }, [recipeId])

  // --- 2. 互动逻辑：收藏 ---
  const handleToggleFavorite = async () => {
    try {
      if (isFavorited) {
        await userApi.removeFavorite(recipeId)
      } else {
        await userApi.addFavorite(recipeId)
      }
      setIsFavorited(!isFavorited)
    } catch (error) {
      alert("收藏操作失败，请重试")
    }
  }

  // --- 3. 互动逻辑：提交评分 ---
  const handleSubmitRating = async () => {
    if (rating === 0) {
      alert("请先选择星级哦！")
      return
    }
    try {
      await userApi.submitRating(recipeId, rating)
      setShowFinishModal(false)
      router.back() // 评分成功后自动返回上一页
    } catch (error) {
      alert("评分提交失败")
    }
  }

  const steps = recipe?.steps || []
  const currentStep = steps[currentStepIndex]

  // --- 4. 智能时间提取 (AI 增强感知) ---
  const extractedMinutes = useMemo(() => {
    if (!currentStep?.description) return 0
    const match = currentStep.description.match(/(\d+)\s*(?:分钟|分)/)
    return match ? parseInt(match[1], 10) : 0
  }, [currentStep?.description])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (extractedMinutes > 0) {
      setTimer({ remaining: extractedMinutes * 60, isRunning: false, initial: extractedMinutes * 60 })
    } else {
      setTimer(null)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentStepIndex, extractedMinutes])

  // --- 5. 计时器控制 ---
  const toggleTimer = () => {
    if (!timer) return
    if (timer.isRunning) {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimer(prev => prev ? { ...prev, isRunning: false } : null)
    } else {
      setTimer(prev => prev ? { ...prev, isRunning: true } : null)
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (!prev || prev.remaining <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return prev ? { ...prev, remaining: 0, isRunning: false } : null
          }
          return { ...prev, remaining: prev.remaining - 1 }
        })
      }, 1000)
    }
  }

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (timer) setTimer({ ...timer, remaining: timer.initial, isRunning: false })
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // --- 6. 渲染界面 ---
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">加载烹饪模式中...</div>
  }

  if (steps.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <ChefHat className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">此菜谱暂无详细步骤</h2>
        <button onClick={() => router.back()} className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors">
          返回上一页
        </button>
      </div>
    )
  }

  const progress = ((currentStepIndex + 1) / steps.length) * 100

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between z-10 sticky top-0">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>

        <h1 className="text-xl font-bold text-slate-800 line-clamp-1 max-w-[50%] text-center">
          {recipe?.name || '烹饪中'}
        </h1>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full hidden sm:inline-block">
            {currentStepIndex + 1} / {steps.length}
          </span>
          {/* 🌟 收藏按钮 */}
          <button
            onClick={handleToggleFavorite}
            className="p-2 rounded-full hover:bg-red-50 transition-colors"
          >
            <Heart className={`w-6 h-6 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
          </button>
        </div>
      </header>

      {/* 进度条 */}
      <div className="h-1.5 w-full bg-slate-200">
        <motion.div className="h-full bg-green-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* 主体卡片区 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-8 sm:p-12 border border-slate-100"
          >
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-black shrink-0">
                {currentStepIndex + 1}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                {currentStep?.title || `步骤 ${currentStepIndex + 1}`}
              </h2>
            </div>

            <p className="text-xl sm:text-2xl text-slate-600 leading-relaxed min-h-[120px]">
              {currentStep?.description}
            </p>

            {/* 倒计时器 */}
            {timer && (
              <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between">
                <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                  <div className={`p-4 rounded-full ${timer.remaining <= 10 && timer.remaining > 0 ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-slate-200 text-slate-600'}`}>
                    <Timer className="w-8 h-8" />
                  </div>
                  <div className="text-5xl font-mono font-bold tracking-tight text-slate-800">
                    {formatTime(timer.remaining)}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button onClick={toggleTimer} className={`flex items-center px-6 py-3 rounded-xl text-white font-semibold text-lg transition-all ${timer.isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'}`}>
                    {timer.isRunning ? <><Pause className="w-5 h-5 mr-2" /> 暂停</> : <><Play className="w-5 h-5 mr-2" /> 开始</>}
                  </button>
                  <button onClick={resetTimer} className="p-3 rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all">
                    <RotateCcw className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 底部控制栏 */}
      <footer className="bg-white border-t border-slate-200 p-6 sm:p-8 flex justify-between items-center z-10">
        <button
          onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
          disabled={currentStepIndex === 0}
          className="flex items-center px-6 py-4 rounded-2xl text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all"
        >
          <ChevronLeft className="w-6 h-6 mr-2" />上一步
        </button>

        {currentStepIndex < steps.length - 1 ? (
          <button
            onClick={() => setCurrentStepIndex(prev => prev + 1)}
            className="flex items-center px-8 py-4 rounded-2xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 font-semibold text-lg transition-all active:scale-95"
          >
            下一步<ChevronRight className="w-6 h-6 ml-2" />
          </button>
        ) : (
          <button
            onClick={() => setShowFinishModal(true)} // 🌟 触发完成评分弹窗
            className="flex items-center px-8 py-4 rounded-2xl text-white bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200 font-semibold text-lg transition-all active:scale-95"
          >
            <Check className="w-6 h-6 mr-2" />完成烹饪
          </button>
        )}
      </footer>

      {/* 🌟 完成烹饪后的评分弹窗 (Modal) */}
      <AnimatePresence>
        {showFinishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative text-center"
            >
              <button onClick={() => setShowFinishModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                <X className="w-6 h-6" />
              </button>

              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ChefHat className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">烹饪完成！🎉</h2>
              <p className="text-slate-500 mb-8">今天的手艺怎么样？给这道菜打个分吧！</p>

              {/* 打分组件 */}
              <div className="flex justify-center space-x-2 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="focus:outline-none transform hover:scale-110 transition-transform"
                  >
                    <Star className={`w-10 h-10 ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => router.back()}
                  className="flex-1 py-4 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold transition-colors"
                >
                  跳过
                </button>
                <button
                  onClick={handleSubmitRating}
                  className="flex-1 py-4 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-colors"
                >
                  提交打分
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}