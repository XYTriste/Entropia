<template>
  <el-container class="app-container">
    <!-- 顶部导航栏 -->
    <el-header class="app-header">
      <div class="header-Left">
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
          background-color="#3B82F6"
          text-color="#ffffff"
          active-text-color="#ffffff"
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

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.header-center .el-menu {
  border-bottom: none;
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
}

.app-main {
  flex: 1;
  overflow-y: auto;
  background-color: #F3F4F6;
  padding: 20px;
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
