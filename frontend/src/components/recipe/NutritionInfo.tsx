'use client'

import React from 'react'

interface NutritionInfoProps {
  recipe: any
}

const NutritionInfo: React.FC<NutritionInfoProps> = ({ recipe }) => {
  // 严格校验：只认真实传过来的 nutrition 数据
  const nutrition = recipe?.nutrition;
  const hasRealData = nutrition && typeof nutrition === 'object' && Object.keys(nutrition).length > 0;

  // 专属图标映射表
  const iconMap: Record<string, string> = {
    "卡路里": "🔥",
    "蛋白质": "🥩",
    "碳水化合物": "🍚",
    "脂肪": "🥑",
    "膳食纤维": "🥬"
  };

  return (
    <div className="w-full bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[300px] flex flex-col justify-center">

      {hasRealData ? (
        <>
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800">营养成分表</h3>
            <p className="text-sm text-slate-500 mt-1">从菜谱中提取的营养信息</p>
          </div>

          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-500">
            {Object.entries(nutrition).map(([key, value]) => {
              // 尝试匹配图标，如果没匹配到默认用 ✨
              const matchedIcon = Object.keys(iconMap).find(k => key.includes(k))
                                  ? iconMap[Object.keys(iconMap).find(k => key.includes(k)) as string]
                                  : "✨";

              return (
                <div
                  key={key}
                  className="group bg-slate-50 hover:bg-blue-50 p-6 rounded-2xl text-center transition-colors duration-300 border border-transparent hover:border-blue-100"
                >
                  <div className="text-3xl mb-3 transform group-hover:scale-110 transition-transform duration-300">
                    {matchedIcon}
                  </div>
                  <div className="text-2xl font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                    {String(value)}
                  </div>
                  <div className="text-slate-500 text-sm font-medium mt-1">
                    {key}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        // 🌟 当没有真实数据时，完美还原你截图中的 UI
        <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto animate-in zoom-in duration-300">
          <div className="w-24 h-24 mb-6 rounded-full bg-slate-50 flex items-center justify-center border-4 border-white shadow-sm">
            <span className="text-5xl">🥗</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">暂无营养数据</h3>
          <p className="text-slate-500 leading-relaxed">
            这份《{recipe?.name || '当前菜谱'}》的作者比较随性，没有留下具体的营养信息哦~
            <br/>
            <span className="text-sm text-slate-400 mt-2 block">你可以安心享用这顿美味！</span>
          </p>
        </div>
      )}

    </div>
  )
}

export default NutritionInfo