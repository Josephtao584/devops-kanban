import { ref, watch } from 'vue'

const STEP_REGEX = /\[STEP\s+(\d+)\](?:\s+(.+?))?(?:\s+DONE)?$/i
const SUBSTEP_REGEX = /\[SUBSTEP\s+(\d+)-(\d+)\](?:\s+(.+?))?$/i

function parseLine(line) {
  const stepMatch = line.match(STEP_REGEX)
  if (stepMatch) {
    return {
      type: 'step',
      number: parseInt(stepMatch[1], 10),
      title: stepMatch[2] ? stepMatch[2].trim() : '',
      done: /DONE$/i.test(line)
    }
  }

  const substepMatch = line.match(SUBSTEP_REGEX)
  if (substepMatch) {
    return {
      type: 'substep',
      stepNumber: parseInt(substepMatch[1], 10),
      substepNumber: parseInt(substepMatch[2], 10),
      title: substepMatch[3] ? substepMatch[3].trim() : ''
    }
  }

  return null
}

function extractTitleFromContent(content) {
  if (typeof content !== 'string') {
    return ''
  }
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parsed = parseLine(trimmed)
    if (parsed && parsed.type === 'step') {
      return parsed.title
    }
  }
  return ''
}

export function usePlanParser(events) {
  const plan = ref({
    steps: [],
    hasPlan: false,
    currentStep: null
  })

  function reset() {
    plan.value = {
      steps: [],
      hasPlan: false,
      currentStep: null
    }
  }

  function processEvents() {
    const newSteps = []
    const seenSteps = new Map()

    const messageEvents = events.value.filter((e) => e?.kind === 'message')
    for (const event of messageEvents) {
      const rawContent = event?.content
      if (typeof rawContent !== 'string') continue
      const content = rawContent
      const lines = content.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        const parsed = parseLine(trimmed)
        if (!parsed) continue

        if (parsed.type === 'step') {
          if (!seenSteps.has(parsed.number)) {
            seenSteps.set(parsed.number, {
              id: parsed.number,
              title: parsed.title,
              status: parsed.done ? 'completed' : 'pending',
              substeps: []
            })
          } else if (parsed.done) {
            seenSteps.get(parsed.number).status = 'completed'
          } else if (!seenSteps.get(parsed.number).title && parsed.title) {
            seenSteps.get(parsed.number).title = parsed.title
          }
        } else if (parsed.type === 'substep') {
          if (!seenSteps.has(parsed.stepNumber)) {
            seenSteps.set(parsed.stepNumber, {
              id: parsed.stepNumber,
              title: '',
              status: 'pending',
              substeps: []
            })
          }
          const step = seenSteps.get(parsed.stepNumber)
          const existingSubstep = step.substeps.find((s) => s.id === parsed.substepNumber)
          if (!existingSubstep) {
            step.substeps.push({
              id: parsed.substepNumber,
              title: parsed.title,
              status: 'pending'
            })
          }
        }
      }
    }

    const sortedStepNumbers = Array.from(seenSteps.keys()).sort((a, b) => a - b)
    for (const num of sortedStepNumbers) {
      newSteps.push(seenSteps.get(num))
    }

    if (newSteps.length > 0) {
      // Mark completed: any step that appears before a later step is completed
      for (let i = 0; i < sortedStepNumbers.length - 1; i++) {
        const step = seenSteps.get(sortedStepNumbers[i])
        if (step.status === 'pending') {
          step.status = 'completed'
        }
      }

      // Find the first non-completed step as current
      let currentStepNum = null
      for (let i = sortedStepNumbers.length - 1; i >= 0; i--) {
        if (newSteps[i].status !== 'completed') {
          currentStepNum = newSteps[i].id
          newSteps[i].status = 'running'
          break
        }
      }

      plan.value = {
        steps: newSteps,
        hasPlan: true,
        currentStep: currentStepNum
      }
    } else {
      plan.value = {
        steps: [],
        hasPlan: false,
        currentStep: null
      }
    }
  }

  watch(
    () => events.value.length,
    () => {
      processEvents()
    },
    { immediate: true }
  )

  return {
    plan,
    reset,
    extractTitleFromContent
  }
}
