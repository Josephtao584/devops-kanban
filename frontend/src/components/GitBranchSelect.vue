<template>
  <el-select
    v-model="selectedBranch"
    :placeholder="placeholder"
    :loading="loading"
    filterable
    clearable
    @change="handleChange"
  >
    <template v-if="grouped">
      <el-option-group :label="$t('git.localBranches', 'Local')">
        <el-option
          v-for="branch in localBranches"
          :key="branch.fullName"
          :label="branch.name"
          :value="branch.name"
        >
          <div class="branch-option">
            <span>{{ branch.name }}</span>
            <el-tag v-if="branch.isCurrent" size="small" type="success" style="margin-left: 8px">
              {{ $t('git.current', 'Current') }}
            </el-tag>
            <span v-if="branch.aheadCount > 0" class="ahead-badge">
              +{{ branch.aheadCount }}
            </span>
          </div>
        </el-option>
      </el-option-group>
      <el-option-group :label="$t('git.remoteBranches', 'Remote')">
        <el-option
          v-for="branch in remoteBranches"
          :key="branch.fullName"
          :label="branch.name"
          :value="branch.name"
        />
      </el-option-group>
    </template>
    <template v-else>
      <el-option
        v-for="branch in branches"
        :key="branch.fullName"
        :label="branch.name"
        :value="branch.name"
      >
        <div class="branch-option">
          <span>
            <el-icon v-if="branch.isRemote" style="margin-right: 4px"><Link /></el-icon>
            {{ branch.name }}
          </span>
          <el-tag v-if="branch.isCurrent" size="small" type="success">
            {{ $t('git.current', 'Current') }}
          </el-tag>
        </div>
      </el-option>
    </template>
  </el-select>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link } from '@element-plus/icons-vue'
import { listBranches } from '../api/git'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  },
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  grouped: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const { t } = useI18n()

const loading = ref(false)
const branches = ref([])
const selectedBranch = ref(props.modelValue)

const localBranches = computed(() =>
  branches.value.filter(b => !b.isRemote)
)

const remoteBranches = computed(() =>
  branches.value.filter(b => b.isRemote)
)

const loadBranches = async () => {
  loading.value = true
  try {
    const response = await listBranches(props.projectId)
    if (response.success) {
      branches.value = response.data || []
    }
  } catch (e) {
    console.error('Failed to load branches:', e)
  } finally {
    loading.value = false
  }
}

const handleChange = (value) => {
  emit('update:modelValue', value)
  emit('change', value)
}

watch(() => props.modelValue, (val) => {
  selectedBranch.value = val
})

watch(() => props.projectId, () => {
  loadBranches()
})

onMounted(() => {
  loadBranches()
})
</script>

<style scoped>
.branch-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.ahead-badge {
  color: #67c23a;
  font-size: 12px;
  margin-left: 8px;
}
</style>
