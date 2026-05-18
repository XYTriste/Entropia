<template>
  <el-container class="app-container">
    <!-- 顶部导航栏 -->
    <el-header class="app-header">
      <div class="header-left">
        <h1 class="app-title">
          <el-icon><Notebook /></el-icon>
          考试排考系统
        </h1>
      </div>

      <div class="header-center">
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          router
          class="dark-nav-menu"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            仪表盘
          </el-menu-item>
          <el-menu-item index="/base-data">
            <el-icon><Setting /></el-icon>
            基础数据
          </el-menu-item>
          <el-menu-item index="/scheduler">
            <el-icon><VideoPlay /></el-icon>
            排考引擎
          </el-menu-item>
          <el-menu-item index="/results">
            <el-icon><TrendCharts /></el-icon>
            排考结果
          </el-menu-item>
          <el-menu-item index="/adjustments">
            <el-icon><Edit /></el-icon>
            手动微调
          </el-menu-item>
          <el-menu-item index="/transfer">
            <el-icon><Switch /></el-icon>
            教师调剂
          </el-menu-item>
          <el-menu-item index="/import-export">
            <el-icon><Upload /></el-icon>
            导入导出
          </el-menu-item>
        </el-menu>
      </div>

      <div class="header-right">
        <span class="user-info">
          <el-icon><User /></el-icon>
          管理员
        </span>
      </div>
    </el-header>

    <!-- 主内容区 -->
    <el-main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Notebook, DataAnalysis, Setting, VideoPlay,
  TrendCharts, Edit, Switch, Upload, User
} from '@element-plus/icons-vue'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0e27;
}

.app-header {
  background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  border-bottom: none;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(90deg, #4fc3f7, #7c4dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.header-center .el-menu {
  border-bottom: none;
  background: transparent;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: #e2e8f0;
  opacity: 0.8;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: #0a0e27;
}

/* 深色导航菜单样式 */
.dark-nav-menu {
  background: transparent !important;
  border: none !important;
  --el-menu-text-color: #e2e8f0;
  --el-menu-hover-text-color: #4fc3f7;
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: rgba(255, 255, 255, 0.05);
  --el-menu-active-color: #4fc3f7;
  --el-menu-hover-border-color: transparent;
  --el-menu-border-color: transparent;
}

/* 菜单项通用样式 */
.dark-nav-menu .el-menu-item {
  color: #e2e8f0 !important;
  background: transparent !important;
  border: none !important;
  transition: all 0.3s ease;
  position: relative;
  margin: 0 2px;
}

.dark-nav-menu .el-menu-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #4fc3f7, #7c4dff);
  transition: width 0.3s ease;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(79, 195, 247, 0.6);
}

.dark-nav-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  color: #4fc3f7 !important;
  transition: all 0.3s ease;
}

/* 激活状态 */
.dark-nav-menu .el-menu-item.is-active {
  color: #4fc3f7 !important;
  background: rgba(79, 195, 247, 0.1) !important;
  border: none !important;
  animation: glow-pulse 2s ease-in-out infinite;
}

.dark-nav-menu .el-menu-item.is-active::after {
  width: 70%;
}

.dark-nav-menu .el-menu-item.is-active .el-icon {
  color: #4fc3f7;
  filter: drop-shadow(0 0 4px rgba(79, 195, 247, 0.6));
}

/* 文字发光脉冲动画 - 与大屏 box-shadow 脉冲风格一致 */
@keyframes glow-pulse {
  0%, 100% {
    text-shadow: 0 0 5px rgba(88, 166, 255, 0.4);
  }
  50% {
    text-shadow: 0 0 10px #58a6ff, 0 0 20px #58a6ff, 0 0 30px rgba(88, 166, 255, 0.5);
  }
}

/* 图标样式 */
.dark-nav-menu .el-menu-item .el-icon {
  color: #e2e8f0;
  transition: all 0.3s ease;
}

.dark-nav-menu .el-menu-item:hover .el-icon {
  color: #4fc3f7;
  filter: drop-shadow(0 0 4px rgba(79, 195, 247, 0.4));
}

/* 移除 Element Plus 默认的下划线 */
.el-menu--horizontal {
  border-bottom: none !important;
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
