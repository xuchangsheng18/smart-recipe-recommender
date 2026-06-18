/** @type {import('next').NextConfig} */
const nextConfig = {
  // 👇 修改这部分：推荐使用 remotePatterns（比纯 domains 更安全，且支持精确到端口）
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000', // 明确放行 8000 端口的图片来源
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      }
    ],
  },

  // Docker 环境配置
  output: 'standalone',

  // 开发环境下的代理转发桥梁
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*' // 将前端的 /api 请求全权交由 8000 端口的 Flask 后端处理
      },
      // 👇 新增这部分：把前端对于静态图片（/static）的请求，也转发给后端的 8000 端口
      {
        source: '/static/:path*',
        destination: 'http://127.0.0.1:8000/static/:path*'
      }
    ]
  }
}

module.exports = nextConfig