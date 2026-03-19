<template>
  <el-select
    v-model="selectedIteration"
    :placeholder="placeholder"
    clearable
    filterable
    :disabled="disabled"
    style="width: 100%"
  >
    <el-option
      :label="$t('iteration.allIterations')"
      :value="null"
    >
      <span>{{ $t('iteration.allIterations') }}</span>
    </el-option>
    <el-option
      v-for="iteration in iterations"
      :key="iteration.id"
      :label="iterationLabel(iteration)"
      :value="iteration.id"
    >
      <div class="iteration-option">
        <span class="iteration-name">{{ iteration.name }}</span>
        <el-tag :type="getStatusType(iteration.status)" size="small">
          {{ getStatusLabel(iteration.status) }}
        </el-tag>
      </div>
    </el-option>
  </el-select>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [Number, String],
    default: null
  },
  iterations: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '选择迭代'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const selectedIteration = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const statusMap = {
  PLANNED: { label: '计划中', type: 'info' },
  ACTIVE: { label: '进行中', type: 'warning' },
  COMPLETED: { label: '已完成', type: 'success' },
  ARCHIVED: { label: '已归档', type: 'info' }
}

const iterationLabel = (iteration) => {
  return iteration.name
}

const getStatusType = (status) => {
  return statusMap[status]?.type || 'info'
}

const getStatusLabel = (status) => {
  return statusMap[status]?.label || status
}
</script>

<style scoped>
.iteration-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.iteration-name {
  flex: 1;
}
</style>
