// 拦截屏蔽可能导致页面运行和路由逻辑中断的第三方（如钉钉SDK）未捕获Promise异常
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (msg.includes('biz.automator') || msg.includes('jsapi') || msg.includes('trace not implemented')) {
    console.warn('[安全拦截] 忽略了非致命的第三方组件异常:', msg);
    event.preventDefault();
  }
});

/**
 * 移动端应用挂载点
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/mobile.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
