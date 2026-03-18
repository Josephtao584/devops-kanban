<template>
  <div v-if="modelValue" class="modal-overlay" @click.self="handleClickOutside">
    <div class="modal" :style="{ maxWidth }">
      <div class="modal-header">
        <slot name="header">
          <h2>{{ title }}</h2>
          <button class="close-btn" @click="$emit('close')">&times;</button>
        </slot>
      </div>

      <div class="modal-body">
        <slot />
      </div>

      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  maxWidth: {
    type: String,
    default: '500px'
  }
})

defineEmits(['close', 'update:modelValue'])

const emit = defineEmits(['close', 'update:modelValue'])

const handleClickOutside = () => {
  emit('close')
}

defineSlots({
  header: () => {},
  default: () => {},
  footer: () => {}
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #718096;
}

.modal-body {
  padding: 1rem;
  flex: 1;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
