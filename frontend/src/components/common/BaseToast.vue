<template>
  <transition name="toast">
    <div v-if="modelValue" class="toast" :class="type">
      {{ message }}
    </div>
  </transition>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'success',
    validator: (value) => ['success', 'error', 'warning', 'info'].includes(value)
  },
  duration: {
    type: Number,
    default: 3000
  }
})

const emit = defineEmits(['update:modelValue'])

// Auto-hide after duration
if (defineProps({}).duration) {
  setTimeout(() => {
    emit('update:modelValue', false)
  }, defineProps({}).duration)
}
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  z-index: 2000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.toast.success {
  background: #48bb78;
}

.toast.error {
  background: #fc8181;
}

.toast.warning {
  background: #ecc94b;
  color: #744210;
}

.toast.info {
  background: #4299e1;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
