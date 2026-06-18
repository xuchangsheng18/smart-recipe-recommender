import { useCallback, useRef } from 'react'
import { useAppStore } from '@/store'
import { apiUtils } from '@/lib/api'

export const useChat = () => {
  const {
    chat, addMessage, updateMessage, setChatLoading, setChatStreaming,
    createChatSession, updateSessionTitle, addToast
  } = useAppStore()

  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    try {
      let sessionId = chat.currentSession?.id
      if (!sessionId) sessionId = createChatSession()

      addMessage(sessionId, { role: 'user', content: content.trim() })

      const currentSession = chat.sessions.find(s => s.id === sessionId)
      if (currentSession && currentSession.messages.length === 0) {
        updateSessionTitle(sessionId, content.trim().substring(0, 30))
      }

      const assistantMessageId = addMessage(sessionId, {
        role: 'assistant',
        content: '',
        metadata: { recipes: [] },
        recipes: []
      } as any)

      setChatLoading(true)
      setChatStreaming(true)

      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()

      // ==========================================
      // 🚀 终极防弹验证：如果控制台没打印这句话，说明你跑的还是旧代码！
      // ==========================================
      console.log('🚀🚀🚀 终极直连引擎已启动！开始请求大模型...');

      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${baseURL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({ message: content, session_id: sessionId, stream: true }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('网络请求失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let rawBuffer = '';
      let displayText = '';
      let extractedRecipes: any[] | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();

          if (value) {
            rawBuffer += decoder.decode(value, { stream: true });

            // 极致安全的分行解析：保证绝对不会把 data: 打印到屏幕上
            const lines = rawBuffer.split('\n');
            // 把最后一行放回 buffer，因为它可能被网络截断了一半
            rawBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.substring(5).trim();

                if (jsonStr === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(jsonStr);

                  if (parsed.chunk !== undefined) {
                    displayText += parsed.chunk;
                  }

                  if (parsed.recipes && Array.isArray(parsed.recipes)) {
                    extractedRecipes = parsed.recipes;
                    console.log('🍽️ 成功在前端提取到菜谱数据！', extractedRecipes);
                  }
                } catch (e) {
                  // 忽略被截断的异常片段
                }
              }
            }

            // 同步渲染纯文本和卡片
            updateMessage(sessionId, assistantMessageId, {
              content: displayText,
              ...(extractedRecipes ? { recipes: extractedRecipes, metadata: { recipes: extractedRecipes } } : {})
            } as any);
          }

          if (done) {
            // 最后兜底：把 buffer 里残余的一点点数据消化掉
            if (rawBuffer.trim().startsWith('data:')) {
               try {
                   const lastStr = rawBuffer.trim().substring(5).trim();
                   if (lastStr !== '[DONE]') {
                       const parsed = JSON.parse(lastStr);
                       if (parsed.chunk) displayText += parsed.chunk;
                       if (parsed.recipes) extractedRecipes = parsed.recipes;
                   }
               } catch(e) {}
            }
            updateMessage(sessionId, assistantMessageId, {
              content: displayText,
              ...(extractedRecipes ? { recipes: extractedRecipes, metadata: { recipes: extractedRecipes } } : {})
            } as any);
            break;
          }
        }
      }

      if (!displayText.trim() && !extractedRecipes) {
        updateMessage(sessionId, assistantMessageId, '抱歉，我现在无法回答您的问题。请稍后再试。')
      }

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('abort')) return;
      updateMessage(chat.currentSession?.id || '', '', '抱歉，网络连接出现问题。请检查您的网络连接后重试。')
      addToast({ type: 'error', title: '发送失败', message: apiUtils.handleError(error as any), duration: 5000 })
    } finally {
      setChatLoading(false)
      setChatStreaming(false)
      abortControllerRef.current = null
    }
  }, [chat.currentSession?.id, chat.sessions, addMessage, updateMessage, setChatLoading, setChatStreaming, createChatSession, updateSessionTitle, addToast])

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setChatLoading(false)
    setChatStreaming(false)
    addToast({ type: 'info', title: '已停止生成', duration: 3000 })
  }, [setChatLoading, setChatStreaming, addToast])

  const regenerateResponse = useCallback(async (messageId: string) => {
    addToast({ type: 'info', title: '提示', message: '请直接重新发送问题', duration: 3000 })
  }, [addToast])

  const copyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      addToast({ type: 'success', title: '已复制到剪贴板', duration: 2000 })
    } catch (error) {
      addToast({ type: 'error', title: '复制失败', message: '无法访问剪贴板', duration: 3000 })
    }
  }, [addToast])

  const provideFeedback = useCallback(async (messageId: string, type: 'like' | 'dislike') => {
    addToast({ type: 'success', title: type === 'like' ? '感谢您的反馈！' : '我们会继续改进', duration: 2000 })
  }, [addToast])

  return { currentSession: chat.currentSession, sessions: chat.sessions, isLoading: chat.isLoading, isStreaming: chat.isStreaming, sendMessage, stopGeneration, regenerateResponse, copyMessage, provideFeedback }
}