<template>
  <div v-if="error" class="plugin-error-boundary">
    <div class="error-icon">⚠️</div>
    <div class="error-message">{{ error.message }}</div>
    <div class="error-detail" v-if="error.detail">{{ error.detail }}</div>
    <div class="error-actions">
      <button v-if="error.recoverable" @click="retry">重试</button>
      <button @click="report">报告问题</button>
      <button @click="close">关闭</button>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
interface ErrorInfo {
  message: string;
  detail?: string;
  recoverable: boolean;
}

defineProps<{
  error: ErrorInfo | null;
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'report'): void;
  (e: 'close'): void;
}>();

function retry() {
  emit('retry');
}

function report() {
  emit('report');
}

function close() {
  emit('close');
}
</script>

<style scoped>
.plugin-error-boundary {
  padding: 20px;
  text-align: center;
  color: #666;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-message {
  font-size: 16px;
  margin-bottom: 8px;
}

.error-detail {
  font-size: 14px;
  color: #999;
  margin-bottom: 16px;
}

.error-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.error-actions button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.error-actions button:hover {
  background: #f5f5f5;
}
</style>
