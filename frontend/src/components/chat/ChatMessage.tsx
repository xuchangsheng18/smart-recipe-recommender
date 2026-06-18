'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, Bot, Copy, ThumbsUp, ThumbsDown, Clock, ChefHat } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage as ChatMessageType } from '@/types'
import { Button } from '@/components/ui'

interface ChatMessageProps {
  message: ChatMessageType
  onCopy?: (content: string) => void
  onFeedback?: (messageId: string, type: 'like' | 'dislike') => void
  isStreaming?: boolean
  className?: string
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onCopy,
  onFeedback,
  isStreaming = false,
  className = ''
}) => {
  const router = useRouter()
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const handleCopy = async () => {
    const textToCopy = displayContent || message.content
    try {
      await navigator.clipboard.writeText(textToCopy)
      onCopy?.(textToCopy)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  // ==========================================
  // 🌟 数据流智能解析器 + 菜谱字段强制标准化
  // ==========================================
  const { displayContent, displayRecipes } = useMemo(() => {
    let content = message.content || ''
    let recipes = message.metadata?.recipes || []

    if (typeof content === 'string' && content.includes('data:')) {
      let extractedText = ''
      const parts = content.split('data:')

      for (let part of parts) {
        part = part.trim()
        if (!part || part === '[DONE]') continue

        try {
          const parsed = JSON.parse(part)
          if (parsed.chunk !== undefined) {
            extractedText += parsed.chunk
          }
          if (parsed.recipes && Array.isArray(parsed.recipes) && parsed.recipes.length > 0) {
            recipes = parsed.recipes
          }
        } catch (e) {}
      }
      content = extractedText
    }

    // 🌟 强制标准化：确保每种来源的菜谱都有统一的字段名
    const normalizedRecipes = recipes.map((r: any) => ({
      id: r.id || r.node_id || r.recipeId || '',
      name: r.name || '美味菜谱',
      description:
        r.description || r.desc || r.summary || r.intro || '美味可口的经典菜谱',
      imageUrl: r.imageUrl || r.image_url || r.image || '/placeholder-recipe.jpg',
      cookingTime: r.cookingTime || r.cooking_time || 30,
      difficulty: r.difficulty || 'easy',
      tags: r.tags || [],
      link: r.link || (r.id ? `/recipe/${r.id}` : '#'),
      servings: r.servings || 2,
      // 保留原始其他字段，避免丢失未来可能用到的数据
      ...r,
    }))

    return { displayContent: content, displayRecipes: normalizedRecipes }
  }, [message.content, message.metadata])

  // 等待状态：AI 正在流式输出，且尚未解析出任何文本或菜谱
  const isWaiting = isAssistant && isStreaming && !displayContent && displayRecipes.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start space-x-4 max-w-4xl mx-auto px-4 py-6 ${className}`}
    >
      {/* 头像 */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
        isUser 
          ? 'bg-blue-500 text-white' 
          : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
      }`}>
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* 消息内容容器 */}
      <div className="flex-1 min-w-0">

        {/* 头部：名称与时间戳 */}
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium text-gray-900">
            {isUser ? '您' : 'AI助手'}
          </span>
          <span className="text-xs text-gray-500">
            {(() => {
              try {
                const date = message.timestamp instanceof Date
                  ? message.timestamp
                  : new Date(message.timestamp);
                return date.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                });
              } catch (error) {
                return '刚刚';
              }
            })()}
          </span>
        </div>

        {/* 聊天气泡本体 */}
        <div className={`chat-message ${isUser ? 'user' : 'assistant'} ${isStreaming && isUser ? 'animate-pulse' : ''}`}>

          {isWaiting ? (
            <div className="flex items-center space-x-1 py-2">
              <div className="loading-dots">
                <div></div><div></div><div></div>
              </div>
              <span className="text-xs text-gray-500 ml-2">知识库检索中...</span>
            </div>
          ) : isUser ? (
            <p className="text-white">{displayContent}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0 text-justify">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-6 mb-3">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-6 mb-3">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-medium mb-2">{children}</h3>,
                  strong: ({ children }) => <strong className="font-bold text-purple-700">{children}</strong>,
                  code: ({ children, className }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>
                    ) : (
                      <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto">
                        <code>{children}</code>
                      </pre>
                    )
                  },
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-500 pl-4 italic my-3">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>

              {isStreaming && !isUser && (
                <span className="inline-block w-1.5 h-4 ml-1 bg-purple-500 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {isAssistant && !isStreaming && displayContent && (
          <div className="flex items-center space-x-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-gray-500 hover:text-gray-700 h-8 px-2"
            >
              <Copy className="w-4 h-4 mr-1" /> 复制
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFeedback?.(message.id, 'like')}
              className="text-gray-500 hover:text-green-600 h-8 px-2"
            >
              <ThumbsUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFeedback?.(message.id, 'dislike')}
              className="text-gray-500 hover:text-red-600 h-8 px-2"
            >
              <ThumbsDown className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* 菜谱卡片展示区 */}
        {isAssistant && displayRecipes.length > 0 && (
          <div className="mt-5 p-5 bg-gradient-to-br from-slate-50 to-purple-50/50 rounded-2xl border border-purple-100 w-full shadow-sm">
            <h4 className="text-base font-bold text-purple-900 mb-4 flex items-center">
              <span className="text-xl mr-2">👨‍🍳</span> 为您匹配到的专属菜谱
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {displayRecipes.slice(0, 6).map((recipe: any, index: number) => {
                const targetId = recipe.id || recipe.node_id || recipe.name;
                const safeUrl = targetId ? `/recipe/${encodeURIComponent(targetId)}` : '#';

                return (
                  <div
                    key={index}
                    className="group flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                    onClick={(e) => {
                      e.preventDefault();
                      if (targetId) router.push(safeUrl);
                    }}
                  >
                    {/* 封面图 */}
                    <div className="w-full h-36 bg-gray-100 overflow-hidden relative">
                      <img
                        src={recipe.imageUrl || `https://placehold.co/400x300/e2e8f0/64748b?text=${encodeURIComponent(recipe.name || '菜谱')}`}
                        alt={recipe.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://placehold.co/400x300/e2e8f0/64748b?text=${encodeURIComponent(recipe.name || '图裂了')}`
                        }}
                      />
                      {recipe.difficulty && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium rounded-full flex items-center">
                          <ChefHat className="w-3 h-3 mr-1" />
                          {recipe.difficulty === 'easy' ? '简单' : recipe.difficulty === 'medium' ? '中等' : '困难'}
                        </div>
                      )}
                    </div>

                    {/* 信息区域 */}
                    <div className="p-3 flex-1 flex flex-col">
                      <h5 className="text-base font-bold text-gray-800 line-clamp-1 group-hover:text-purple-600 transition-colors">
                        {recipe.name}
                      </h5>

                      {/* 🌟 描述：使用标准化后的字段，不再依赖兜底 */}
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2 min-h-[32px]">
                        {recipe.description}
                      </p>

                      <div className="mt-auto pt-3 flex items-center justify-between">
                        {recipe.cookingTime && (
                          <div className="flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            {recipe.cookingTime} 分钟
                          </div>
                        )}
                      </div>

                      {recipe.tags && recipe.tags.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {recipe.tags.slice(0, 3).map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 建议问题 */}
        {message.metadata?.suggestions && message.metadata.suggestions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              💡 您可能还想问：
            </h4>
            <div className="flex flex-wrap gap-2">
              {message.metadata.suggestions.map((suggestion: string, index: number) => (
                <Button
                  key={index}
                  variant="glass"
                  size="sm"
                  className="text-sm text-gray-600 bg-white"
                  onClick={() => {
                    console.log('Suggested question:', suggestion)
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default ChatMessage