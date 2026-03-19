<template>
  <div class="iteration-list">
    <div v-if="iterations.length === 0" class="empty-state">
      <el-empty :description="$t('iteration.noIterations')" />
    </div>

    <div v-else class="iterations-grid">
      <IterationCard
        v-for="iteration in iterations"
        :key="iteration.id"
        :iteration="iteration"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @click="$emit('click', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import IterationCard from './IterationCard.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  iterations: {
    type: Array,
    default: () => []
  }
})

defineEmits(['click', 'edit', 'delete'])
</script>

<style scoped>
.iterations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 16px;
}

.empty-state {
  padding: 40px;
}
</style>
