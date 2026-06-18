'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, Thermometer, ChefHat, Play, Pause, RotateCcw } from 'lucide-react'
import { CookingStep } from '@/types'
import { Card, Button } from '@/components/ui'

interface CookingStepsProps {
  steps: CookingStep[]
  currentStep?: number
  onStepComplete?: (stepId: string) => void
  onStepChange?: (stepNumber: number) => void
  className?: string
}

const CookingSteps: React.FC<CookingStepsProps> = ({
  steps,
  currentStep = 0,
  onStepComplete,
  onStepChange,
  className = ''
}) => {
  const safeSteps = steps || []

  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [timers, setTimers] = useState<Record<string, { remaining: number; isRunning: boolean }>>({})
  const intervalRefs = useRef<Record<string, NodeJS.Timeout>>({})

  useEffect(() => {
    return () => {
      Object.values(intervalRefs.current).forEach(clearInterval)
    }
  }, [])

  // 🌟 核心修复：引入严格的线性步骤拦截与联动逻辑
  const handleStepToggle = (uniqueStepId: string, currentStepIndex: number) => {

    const newCompleted = new Set(completedSteps)
    const isCurrentlyCompleted = newCompleted.has(uniqueStepId)

    if (!isCurrentlyCompleted) {
      // 1. 【正向打勾拦截】: 必须确保当前步骤之前的所有步骤都已经打勾完成
      for (let i = 0; i < currentStepIndex; i++) {
        const prevStepId = safeSteps[i].id || `step_${i}`
        if (!newCompleted.has(prevStepId)) {
          alert(`提示：请先按顺序完成前面的 “步骤 ${i + 1}” 哦！`)
          return
        }
      }

      // 通过检查，允许打勾
      newCompleted.add(uniqueStepId)

      // 自动聚焦并跳转到下一步
      if (currentStepIndex + 1 < safeSteps.length) {
        onStepChange?.(currentStepIndex + 1)
      }
    } else {
      // 2. 【反向级联取消】: 如果取消了某一步，其后面所有已经打勾的步骤必须同步自动取消
      newCompleted.delete(uniqueStepId)

      for (let i = currentStepIndex + 1; i < safeSteps.length; i++) {
        const nextStepId = safeSteps[i].id || `step_${i}`
        newCompleted.delete(nextStepId)
      }

      // 焦点退回到当前取消的步骤上
      onStepChange?.(currentStepIndex)
    }

    setCompletedSteps(newCompleted)
    onStepComplete?.(uniqueStepId)
  }

  // 计时器核心控制
  const startTimer = (stepId: string, duration: number) => {
    if (intervalRefs.current[stepId]) {
      clearInterval(intervalRefs.current[stepId])
    }

    setTimers(prev => ({
      ...prev,
      [stepId]: { remaining: duration * 60, isRunning: true }
    }))

    intervalRefs.current[stepId] = setInterval(() => {
      setTimers(prev => {
        const timer = prev[stepId]
        if (!timer || !timer.isRunning || timer.remaining <= 0) {
          clearInterval(intervalRefs.current[stepId])
          delete intervalRefs.current[stepId]
          return prev
        }
        return {
          ...prev,
          [stepId]: { ...timer, remaining: timer.remaining - 1 }
        }
      })
    }, 1000)
  }

  const toggleTimer = (stepId: string) => {
    setTimers(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], isRunning: !prev[stepId]?.isRunning }
    }))
  }

  const resetTimer = (stepId: string, duration: number) => {
    if (intervalRefs.current[stepId]) {
      clearInterval(intervalRefs.current[stepId])
      delete intervalRefs.current[stepId]
    }
    setTimers(prev => ({
      ...prev,
      [stepId]: { remaining: duration * 60, isRunning: false }
    }))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progressPercentage = safeSteps.length > 0
    ? Math.round((completedSteps.size / safeSteps.length) * 100)
    : 0

  if (safeSteps.length === 0) {
    return <div className="text-gray-500 text-center py-8">暂无详细烹饪步骤</div>
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900 flex items-center">
          <ChefHat className="w-5 h-5 mr-2" />
          烹饪步骤
        </h3>
        <div className="text-sm text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full">
          {completedSteps.size} / {safeSteps.length} 已完成
        </div>
      </div>

      <div className="space-y-4 pb-24">
        {safeSteps.map((step, index) => {
          const uniqueStepId = step.id || `step_${index}`
          const isCompleted = completedSteps.has(uniqueStepId)
          const isCurrent = currentStep === index
          const timer = timers[uniqueStepId]

          // 🌟 视觉微调：动态判断该步骤是否处于“锁定”状态（即前置步骤未完）
          let isLocked = false
          if (index > 0) {
            const prevStepId = safeSteps[index - 1].id || `step_${index - 1}`
            isLocked = !completedSteps.has(prevStepId)
          }

          return (
            <motion.div
              key={uniqueStepId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                variant="glass"
                onClick={() => handleStepToggle(uniqueStepId, index)}
                className={`cooking-step cursor-pointer transition-all duration-300 border-2 ${
                  isCompleted 
                    ? 'completed opacity-60 bg-gray-50 border-transparent' 
                    : isCurrent 
                      ? 'active border-blue-400 shadow-md bg-blue-50/20' 
                      : isLocked
                        ? 'border-transparent opacity-40 cursor-not-allowed select-none' // 未解锁样式
                        : 'border-transparent hover:border-gray-200 shadow-sm bg-white'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* 步骤标号圈 */}
                    <div className="flex-shrink-0 mt-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 font-bold ${
                          isCompleted
                            ? 'bg-green-500 text-white shadow-md'
                            : isCurrent
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isCompleted ? <Check className="w-5 h-5" /> : <span>{step.stepNumber || index + 1}</span>}
                      </div>
                    </div>

                    {/* 文本主体 */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-lg font-bold mb-2 transition-colors ${
                        isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}>
                        {step.title || `步骤 ${index + 1}`}
                      </h4>

                      <p className={`mb-4 leading-relaxed ${isCompleted ? 'text-gray-400' : 'text-gray-700'}`}>
                        {step.description}
                      </p>

                      {/* 时间/温度组件 */}
                      {(step.duration || step.temperature) && (
                        <div className="flex items-center space-x-4 mb-4 text-sm font-medium text-gray-500 bg-white/60 inline-flex px-3 py-1.5 rounded-lg">
                          {step.duration && (
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span>{step.duration} 分钟</span>
                            </div>
                          )}
                          {step.temperature && (
                            <div className="flex items-center space-x-1 ml-4">
                              <Thermometer className="w-4 h-4 text-red-500" />
                              <span>{step.temperature}°C</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 独立计时器 */}
                      {step.duration && (
                        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center space-x-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100 inline-flex">
                            {timer ? (
                              <>
                                <div className={`px-4 py-1 rounded-lg text-lg font-mono font-bold ${timer.remaining <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                                  {formatTime(timer.remaining)}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={timer.isRunning ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'}
                                  onClick={() => toggleTimer(uniqueStepId)}
                                >
                                  {timer.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400"
                                  onClick={() => resetTimer(uniqueStepId, step.duration!)}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="glass"
                                size="sm"
                                className="text-blue-600 font-medium"
                                onClick={() => startTimer(uniqueStepId, step.duration!)}
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                开始 {step.duration} 分钟计时
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 小贴士 */}
                      {step.tips && step.tips.length > 0 && (
                        <div className="bg-amber-50/60 rounded-xl p-4 mt-4 border border-amber-100/70">
                          <h5 className="text-sm font-bold text-amber-800 mb-2 flex items-center">💡 温馨提示</h5>
                          <ul className="space-y-1">
                            {step.tips.map((tip, tIndex) => (
                              <li key={tIndex} className="text-sm text-amber-700 leading-relaxed">• {tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* 底部悬浮全局进度条 */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between space-x-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">整体烹饪进度</span>
              <span className="text-sm font-bold text-green-600">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-green-400 to-green-500 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CookingSteps