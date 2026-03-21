<template>
  <el-select
    v-model="selectedIteration"
    :placeholder="placeholder"
    clearable
    filterable
    :disabled="disabled"
    value-key="id"
    style="width: 100%"
  >
    <el-option
      :label="$t('iteration.allIterations')"
      :value="ALL_ITERATIONS_VALUE"
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

// Use a symbol or special string to represent "all iterations" instead of null
// This avoids Element Plus prop validation issues with null values
const ALL_ITERATIONS_VALUE = '__ALL__'

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
  get: () => {
    const val = props.modelValue
    // Convert null/undefined to ALL_ITERATIONS_VALUE for display
    if (val == null) return ALL_ITERATIONS_VALUE
    // Ensure numeric type for iteration IDs to match option values
    if (typeof val === 'string' && /^\d+$/.test(val)) {
      return Number(val)
    }
    return val
  },
  set: (value) => {
    // Convert ALL_ITERATIONS_VALUE back to null for emission
    emit('update:modelValue', value === ALL_ITERATIONS_VALUE ? null : value)
  }
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
