<template>
  <div class="home-view">
    <!-- Header -->
    <div class="home-header">
      <div class="wordmark">PACER</div>
      <div class="greeting">
        <h1>{{ greeting }}</h1>
        <p class="sub">{{ subtext }}</p>
      </div>
    </div>

    <!-- Weekly stats strip -->
    <div class="stats-strip">
      <div class="stat-card" v-for="stat in weeklyStats" :key="stat.label">
        <span class="stat-val">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>

    <!-- Weekly goal -->
    <div class="goal-card">
      <div class="goal-header">
        <span class="goal-label">This Week</span>
        <span class="goal-numbers">
          <span class="goal-current">{{ runStore.weeklyMiles.toFixed(1) }}</span>
          <span class="goal-sep"> / {{ settingsStore.weeklyGoalMi }} mi</span>
        </span>
      </div>
      <div class="goal-bar-track">
        <div
          class="goal-bar-fill"
          :style="{ width: goalPct + '%' }"
          :class="{ complete: goalPct >= 100 }"
        />
      </div>
      <p v-if="goalPct >= 100" class="goal-message">🎉 Weekly goal crushed!</p>
      <p v-else class="goal-message">{{ miToGo }} mi to go</p>
    </div>

    <!-- ── Training Plan card ─────────────────────────────────── -->
    <div v-if="authStore.isAuthenticated">

      <!-- No plan yet → setup CTA -->
      <div v-if="!planStore.plan && !planStore.loading" class="plan-cta" @click="showSetup = true">
        <div class="plan-cta-left">
          <span class="plan-cta-icon">🎯</span>
          <div>
            <div class="plan-cta-title">AI Training Plan</div>
            <div class="plan-cta-sub">Set a race goal, get a personalised plan</div>
          </div>
        </div>
        <span class="plan-cta-arrow">›</span>
      </div>

      <!-- Loading plan -->
      <div v-else-if="planStore.loading" class="plan-card">
        <div class="plan-loading">
          <span class="ai-dots"><span /><span /><span /></span>
          <span>Loading your plan…</span>
        </div>
      </div>

      <!-- Active plan -->
      <div v-else-if="planStore.plan" class="plan-card">
        <!-- Plan header — tap to see full plan -->
        <div class="plan-header" @click="showFullPlan = true" style="cursor:pointer">
          <div class="plan-title-row">
            <span class="plan-chip">🎯 {{ goalLabel }}</span>
            <span class="plan-week-badge">
              Week {{ planStore.currentWeekNumber ?? '—' }} of {{ planStore.plan.totalWeeks }}
            </span>
            <span class="plan-see-all">See all ›</span>
          </div>
          <div class="plan-race-row">
            <span class="plan-race-date">{{ formatRaceDate(planStore.plan.goalDate) }}</span>
            <span v-if="planStore.daysToRace !== null" class="plan-days-left">
              {{ planStore.daysToRace }}d to go
            </span>
          </div>
        </div>

        <!-- Week strip: 7-day dots -->
        <div v-if="planStore.currentWeek" class="week-strip">
          <div
            v-for="day in weekDays"
            :key="day.date"
            class="week-day"
            :class="{
              today:     day.isToday,
              scheduled: day.workout,
              past:      day.isPast && !day.isToday,
            }"
          >
            <span class="week-day-label">{{ day.label }}</span>
            <span class="week-day-dot">
              <template v-if="day.workout">{{ planStore.typeEmoji[day.workout.type] ?? '🔵' }}</template>
              <template v-else>·</template>
            </span>
          </div>
        </div>

        <!-- Today's workout -->
        <div v-if="planStore.todayWorkout" class="today-workout">
          <div class="today-header">
            <span class="today-badge">Today</span>
            <span class="today-type">{{ planStore.todayWorkout.type }}</span>
          </div>
          <div class="today-details">
            <span class="today-dist">{{ planStore.todayWorkout.distanceMi }} mi</span>
            <span class="today-notes">{{ planStore.todayWorkout.notes }}</span>
          </div>
          <button class="start-plan-btn" @click="$router.push('/run')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Start This Run
          </button>
        </div>

        <!-- Rest day -->
        <div v-else-if="planStore.currentWeek" class="rest-day">
          <span class="rest-icon">💤</span>
          <span class="rest-text">Rest day — recovery is training too</span>
        </div>

        <!-- Week theme + reset -->
        <div class="plan-footer">
          <span v-if="planStore.currentWeek" class="week-theme">{{ planStore.currentWeek.theme }}</span>
          <button class="reset-plan-btn" @click="confirmReset = true">Reset plan</button>
        </div>
      </div>
    </div>

    <!-- Start run CTA -->
    <button class="start-btn" @click="$router.push('/run')">
      <span class="start-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
      </span>
      Start Run
    </button>

    <!-- Recent runs section -->
    <div class="section-header">Recent Runs</div>

    <!-- ── Goal setup sheet ───────────────────────────────────── -->
    <Transition name="slide-up">
      <div v-if="showSetup" class="setup-sheet">
        <!-- Scrollable content area -->
        <div class="setup-scroll">
          <div class="setup-handle" />
          <h2 class="setup-title">Set Your Race Goal</h2>

          <div class="setup-field">
            <label class="setup-label">Race distance</label>
            <div class="goal-options">
              <button
                v-for="g in goalOptions"
                :key="g.value"
                class="goal-option"
                :class="{ selected: setupGoal === g.value }"
                @click="setupGoal = g.value"
              >
                <span class="goal-opt-emoji">{{ g.emoji }}</span>
                <span class="goal-opt-name">{{ g.label }}</span>
              </button>
            </div>
          </div>

          <div class="setup-field">
            <label class="setup-label">Race date</label>
            <div class="date-selects">
              <select v-model="setupMonth" class="date-select">
                <option value="" disabled>Month</option>
                <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <select v-model="setupDay" class="date-select">
                <option value="" disabled>Day</option>
                <option v-for="d in availableDays" :key="d" :value="d">{{ d }}</option>
              </select>
              <select v-model="setupYear" class="date-select">
                <option value="" disabled>Year</option>
                <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
          </div>

          <p v-if="setupError" class="setup-error">{{ setupError }}</p>
        </div>

        <!-- Sticky bottom actions — always visible -->
        <div class="setup-actions">
          <button class="ctrl-btn secondary" @click="showSetup = false">Cancel</button>
          <button
            class="ctrl-btn primary"
            :disabled="!setupGoal || !setupDate || generating"
            @click="handleGenerate"
          >
            <span v-if="generating" class="ai-dots small"><span /><span /><span /></span>
            <span v-else>Generate Plan ✦</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Full plan sheet ────────────────────────────────────── -->
    <Transition name="slide-up">
      <div v-if="showFullPlan" class="full-plan-sheet">
        <div class="full-plan-header">
          <button class="full-plan-close" @click="showFullPlan = false">✕</button>
          <span class="full-plan-title">🎯 {{ goalLabel }} Plan</span>
          <span class="full-plan-sub">{{ formatRaceDate(planStore.plan?.goalDate) }} · {{ planStore.daysToRace }}d to go</span>
        </div>

        <div class="full-plan-scroll">
          <div
            v-for="week in planStore.plan?.weeks"
            :key="week.weekNumber"
            class="fp-week"
            :class="{ 'fp-week--current': week.weekNumber === planStore.currentWeekNumber }"
          >
            <div class="fp-week-header">
              <span class="fp-week-num">Week {{ week.weekNumber }}</span>
              <span class="fp-week-theme">{{ week.theme }}</span>
              <span v-if="week.weekNumber === planStore.currentWeekNumber" class="fp-current-badge">Now</span>
            </div>
            <div class="fp-workouts">
              <div
                v-for="wo in week.workouts"
                :key="wo.date"
                class="fp-workout"
              >
                <span class="fp-wo-emoji">{{ planStore.typeEmoji[wo.type] ?? '🔵' }}</span>
                <div class="fp-wo-info">
                  <span class="fp-wo-day">{{ formatShortDate(wo.date) }}</span>
                  <span class="fp-wo-type">{{ wo.type }}</span>
                  <span class="fp-wo-dist">{{ wo.distanceMi }} mi</span>
                </div>
                <span class="fp-wo-notes">{{ wo.notes }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Backdrop for setup sheet -->
    <Transition name="fade">
      <div v-if="showSetup || showFullPlan" class="sheet-backdrop" @click="showSetup = false; showFullPlan = false" />
    </Transition>

    <!-- Reset confirm -->
    <Transition name="fade">
      <div v-if="confirmReset" class="confirm-overlay">
        <div class="confirm-box">
          <p class="confirm-msg">Delete your training plan?</p>
          <div class="confirm-actions">
            <button class="ctrl-btn secondary" @click="confirmReset = false">Keep it</button>
            <button class="ctrl-btn danger" @click="handleDeletePlan">Delete</button>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="runStore.runs.length === 0" class="empty-state">
      <div class="empty-icon">🏃</div>
      <p>No runs yet.</p>
      <p class="empty-sub">Hit Start Run to record your first route.</p>
    </div>

    <div v-else class="run-list">
      <div
        v-for="run in runStore.runs.slice(0, 5)"
        :key="run.id"
        class="run-card"
      >
        <div class="run-card-left">
          <span class="run-name">{{ run.name || 'Unnamed Run' }}</span>
          <span class="run-date">{{ formatDate(run.date) }}</span>
        </div>
        <div class="run-card-right">
          <span class="run-dist">{{ (run.distance / 1609.344).toFixed(2) }} mi</span>
          <span class="run-duration">{{ formatDuration(run.duration) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRunStore } from '@/stores/run'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { usePlanStore } from '@/stores/plan'

const runStore      = useRunStore()
const authStore     = useAuthStore()
const settingsStore = useSettingsStore()
const planStore     = usePlanStore()

// ── Plan setup sheet ───────────────────────────────────────────
const showSetup    = ref(false)
const showFullPlan = ref(false)
const setupGoal    = ref('')
const setupMonth   = ref('')
const setupDay     = ref('')
const setupYear    = ref('')
const setupError   = ref('')
const generating   = ref(false)
const confirmReset = ref(false)

const goalOptions = [
  { value: '5k',       label: '5K',           emoji: '🎽' },
  { value: '10k',      label: '10K',           emoji: '⭐' },
  { value: 'half',     label: 'Half Marathon', emoji: '🌟' },
  { value: 'marathon', label: 'Marathon',      emoji: '🏆' },
]

const months = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' },   { value: '04', label: 'April' },
  { value: '05', label: 'May' },     { value: '06', label: 'June' },
  { value: '07', label: 'July' },    { value: '08', label: 'August' },
  { value: '09', label: 'September'},{ value: '10', label: 'October' },
  { value: '11', label: 'November' },{ value: '12', label: 'December' },
]

// Years: current through current+3
const availableYears = computed(() => {
  const y = new Date().getFullYear()
  return [y, y + 1, y + 2, y + 3]
})

// Days: 1-31, clamped to the selected month/year
const availableDays = computed(() => {
  const m = parseInt(setupMonth.value) || 1
  const y = parseInt(setupYear.value)  || new Date().getFullYear()
  const max = new Date(y, m, 0).getDate()
  return Array.from({ length: max }, (_, i) => String(i + 1).padStart(2, '0'))
})

// Composed ISO date string from the three selects
const setupDate = computed(() => {
  if (!setupMonth.value || !setupDay.value || !setupYear.value) return ''
  return `${setupYear.value}-${setupMonth.value}-${setupDay.value}`
})

// Minimum race date: 4 weeks from today
const minRaceDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 28)
  return d.toISOString().slice(0, 10)
})

async function handleGenerate() {
  setupError.value = ''
  if (!setupGoal.value || !setupDate.value) {
    setupError.value = 'Please select a race distance and date.'
    return
  }
  if (setupDate.value < minRaceDate.value) {
    setupError.value = 'Race date must be at least 4 weeks away.'
    return
  }
  generating.value = true
  try {
    await planStore.generate(
      authStore.uid,
      { goalType: setupGoal.value, goalDate: setupDate.value },
      runStore.runs,
    )
    showSetup.value  = false
    setupGoal.value  = ''
    setupMonth.value = ''
    setupDay.value   = ''
    setupYear.value  = ''
  } catch {
    setupError.value = 'Could not generate plan. Try again.'
  } finally {
    generating.value = false
  }
}

async function handleDeletePlan() {
  confirmReset.value = false
  await planStore.deletePlan(authStore.uid)
}

// ── Plan display helpers ───────────────────────────────────────
const goalLabels = { '5k': '5K', '10k': '10K', 'half': 'Half Marathon', 'marathon': 'Marathon' }
const goalLabel  = computed(() => goalLabels[planStore.plan?.goalType] ?? '')

function formatRaceDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Build a 7-element array (Mon–Sun) for the current week strip */
const weekDays = computed(() => {
  const week = planStore.currentWeek
  if (!week) return []
  const monday = new Date(week.startDate + 'T00:00:00')
  const todayStr = new Date().toISOString().slice(0, 10)
  const labels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  return labels.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const workout = week.workouts?.find((w) => w.date === dateStr) ?? null
    return {
      label,
      date:    dateStr,
      workout,
      isToday: dateStr === todayStr,
      isPast:  dateStr < todayStr,
    }
  })
})

const goalPct = computed(() => {
  if (!settingsStore.weeklyGoalMi) return 0
  return Math.min(100, (runStore.weeklyMiles / settingsStore.weeklyGoalMi) * 100)
})

const miToGo = computed(() => {
  const remaining = settingsStore.weeklyGoalMi - runStore.weeklyMiles
  return Math.max(0, remaining).toFixed(1)
})

// Dynamic greeting using the signed-in user's first name if available
const greeting = computed(() => {
  const h = new Date().getHours()
  const timeWord = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const firstName = authStore.displayName?.split(' ')[0]
  const name = firstName && firstName !== 'Runner' ? `, ${firstName}` : ''
  return `Good ${timeWord}${name} 👋`
})

const subtext = computed(() => {
  return runStore.runs.length === 0
    ? 'Ready to log your first run?'
    : `${runStore.runs.length} run${runStore.runs.length !== 1 ? 's' : ''} logged`
})

const weeklyStats = computed(() => {
  const totalKm = runStore.runs.reduce((acc, r) => acc + r.distance / 1000, 0)
  const totalRuns = runStore.runs.length
  const bestPace = runStore.runs.reduce((best, r) => {
    if (!r.duration || !r.distance) return best
    const pace = r.duration / 60000 / (r.distance / 1000)
    return best === null || pace < best ? pace : best
  }, null)

  const fmtPace = (p) => {
    if (p === null) return '—'
    const m = Math.floor(p)
    const s = Math.round((p - m) * 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return [
    { label: 'Total mi',  value: (totalKm * 0.621371).toFixed(1) },
    { label: 'Runs',      value: totalRuns || '—' },
    { label: 'Best pace', value: fmtPace(bestPace) },
  ]
})

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  })
}

function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m ${s % 60}s`
}
</script>

<style scoped>
.home-view {
  flex: 1;
  overflow-y: auto;
  padding: calc(env(safe-area-inset-top) + 1.5rem) 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--bg);
}

.home-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.wordmark {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: #f5a623;
  margin-bottom: 0.25rem;
}

.greeting h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.sub {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: var(--text-2);
}

/* Weekly goal card */
.goal-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem 1rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.goal-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.goal-numbers { font-size: 0.88rem; }
.goal-current { font-weight: 700; color: #f5a623; font-variant-numeric: tabular-nums; }
.goal-sep     { color: var(--text-2); }

.goal-bar-track {
  height: 7px;
  background: var(--bg-elevated);
  border-radius: 99px;
  overflow: hidden;
}

.goal-bar-fill {
  height: 100%;
  background: #f5a623;
  border-radius: 99px;
  transition: width 0.4s ease;
}

.goal-bar-fill.complete { background: var(--success); }

.goal-message {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-2);
}

/* Stats strip */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.stat-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.stat-val {
  font-size: 1.3rem;
  font-weight: 700;
  color: #f5a623;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.65rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Start button */
.start-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: #f5a623;
  color: #0f0f0f;
  border: none;
  border-radius: 16px;
  padding: 1.1rem 1.5rem;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}

.start-btn:active {
  background: #d4901d;
  transform: scale(0.98);
}

.start-icon {
  display: flex;
  align-items: center;
}

/* Section header */
.section-header {
  font-size: 0.75rem;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 2.5rem 0;
  color: #555;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.empty-state p {
  margin: 0;
  font-size: 0.95rem;
}

.empty-sub {
  font-size: 0.82rem !important;
  color: #444 !important;
}

/* Run list */
.run-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.run-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.run-card-left {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.run-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.run-date {
  font-size: 0.75rem;
  color: var(--text-2);
}

.run-card-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.run-dist {
  font-size: 1rem;
  font-weight: 700;
  color: #f5a623;
}

.run-duration {
  font-size: 0.75rem;
  color: #888;
}

/* ── Plan CTA (no plan yet) ──────────────────────────────────── */
.plan-cta {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s;
}
.plan-cta:active { opacity: 0.7; }

.plan-cta-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.plan-cta-icon { font-size: 1.5rem; }

.plan-cta-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.plan-cta-sub {
  font-size: 0.75rem;
  color: var(--text-2);
  margin-top: 0.1rem;
}

.plan-cta-arrow {
  font-size: 1.3rem;
  color: var(--text-3);
}

/* ── Active plan card ────────────────────────────────────────── */
.plan-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.plan-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-2);
  font-size: 0.85rem;
  padding: 0.5rem 0;
}

.plan-header { display: flex; flex-direction: column; gap: 0.35rem; }

.plan-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plan-chip {
  background: rgba(245,166,35,0.12);
  color: #f5a623;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  letter-spacing: 0.04em;
}

.plan-week-badge {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-2);
}

.plan-race-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.plan-race-date {
  font-size: 0.78rem;
  color: var(--text-2);
}

.plan-days-left {
  font-size: 0.72rem;
  font-weight: 700;
  color: #f5a623;
  background: rgba(245,166,35,0.1);
  padding: 0.1rem 0.45rem;
  border-radius: 20px;
}

/* ── Week strip ─────────────────────────────────────────────── */
.week-strip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
}

.week-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.35rem 0.2rem;
  border-radius: 8px;
  transition: background 0.15s;
}

.week-day.today {
  background: rgba(245,166,35,0.12);
}

.week-day-label {
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.week-day.today .week-day-label { color: #f5a623; }

.week-day-dot {
  font-size: 0.85rem;
  line-height: 1;
  color: var(--text-3);
}

.week-day.scheduled .week-day-dot { font-size: 0.95rem; }
.week-day.past { opacity: 0.4; }

/* ── Today's workout ────────────────────────────────────────── */
.today-workout {
  background: var(--bg-elevated);
  border-radius: 12px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.today-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.today-badge {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #f5a623;
  background: rgba(245,166,35,0.12);
  padding: 0.15rem 0.45rem;
  border-radius: 20px;
}

.today-type {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text);
}

.today-details {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.today-dist {
  font-size: 1.35rem;
  font-weight: 800;
  color: #f5a623;
  font-variant-numeric: tabular-nums;
}

.today-notes {
  font-size: 0.78rem;
  color: var(--text-2);
  line-height: 1.4;
  flex: 1;
}

.start-plan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: #f5a623;
  color: #0f0f0f;
  border: none;
  border-radius: 10px;
  padding: 0.65rem 1rem;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: opacity 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.start-plan-btn:active { opacity: 0.75; transform: scale(0.97); }

/* ── Rest day / week theme ───────────────────────────────────── */
.rest-day {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.rest-icon { font-size: 1.1rem; }

.rest-text {
  font-size: 0.82rem;
  color: var(--text-2);
}

.week-theme {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
}

.plan-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plan-see-all {
  font-size: 0.72rem;
  color: var(--text-3);
  margin-left: auto;
}

.reset-plan-btn {
  background: none;
  border: none;
  font-size: 0.72rem;
  color: var(--text-4);
  cursor: pointer;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
.reset-plan-btn:active { color: #ff453a; }

/* ── Setup sheet ─────────────────────────────────────────────── */
.setup-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 90vh;
  background: var(--bg-card);
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.4);
}

/* Scrollable content inside the sheet */
.setup-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1.25rem 1.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.setup-handle {
  width: 36px;
  height: 4px;
  background: var(--divider);
  border-radius: 2px;
  align-self: center;
  margin-bottom: 0.25rem;
}

.setup-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
}

.setup-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setup-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-2);
}

.goal-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.goal-option {
  background: var(--bg-elevated);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.goal-option.selected {
  border-color: #f5a623;
  background: rgba(245,166,35,0.08);
}

.goal-opt-emoji { font-size: 1.4rem; }

.goal-opt-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.goal-option.selected .goal-opt-name { color: #f5a623; }

.date-selects {
  display: grid;
  grid-template-columns: 2fr 1fr 1.3fr;
  gap: 0.5rem;
}

.date-select {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.7rem 0.5rem;
  color: var(--text);
  font-size: 0.88rem;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  text-align: center;
}

.date-select:focus { border-color: #f5a623; }

.setup-error {
  margin: 0;
  font-size: 0.8rem;
  color: #ff453a;
}

.setup-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem calc(env(safe-area-inset-bottom) + 1rem);
  border-top: 1px solid var(--border-sub);
  background: var(--bg-card);
  flex-shrink: 0;
}

/* ── Backdrop ────────────────────────────────────────────────── */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99;
}

/* ── Confirm reset overlay ───────────────────────────────────── */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 110;
  padding: 1.5rem;
}

.confirm-box {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
}

.confirm-msg {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  text-align: center;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
}

/* ── Ctrl-btn (reused from RunView) ──────────────────────────── */
.ctrl-btn {
  flex: 1;
  padding: 0.85rem;
  border-radius: 14px;
  border: none;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.ctrl-btn:active    { opacity: 0.75; transform: scale(0.97); }
.ctrl-btn:disabled  { opacity: 0.45; cursor: default; }
.ctrl-btn.primary   { background: #f5a623; color: #0f0f0f; }
.ctrl-btn.secondary { background: var(--bg-elevated); color: var(--text); }
.ctrl-btn.danger    { background: #ff453a; color: #fff; }

/* ── AI loading dots ─────────────────────────────────────────── */
.ai-dots {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.ai-dots span {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-2);
  animation: dot-bounce 1.2s ease-in-out infinite;
}

.ai-dots.small span { width: 5px; height: 5px; background: #0f0f0f; }

.ai-dots span:nth-child(2) { animation-delay: 0.2s; }
.ai-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%            { transform: scale(1);   opacity: 1;   }
}

/* ── Full plan sheet ─────────────────────────────────────────── */
.full-plan-sheet {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding-top: max(1rem, env(safe-area-inset-top));
}

.full-plan-header {
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border-sub);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex-shrink: 0;
  position: relative;
}

.full-plan-close {
  position: absolute;
  top: 0.85rem;
  right: 1.25rem;
  background: var(--bg-elevated);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 0.85rem;
  color: var(--text-2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}

.full-plan-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}

.full-plan-sub {
  font-size: 0.78rem;
  color: var(--text-2);
}

.full-plan-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1rem 1.25rem calc(env(safe-area-inset-bottom) + 1rem);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fp-week {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  border: 2px solid transparent;
}

.fp-week--current {
  border-color: #f5a623;
}

.fp-week-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fp-week-num {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fp-week-theme {
  font-size: 0.75rem;
  color: var(--text-2);
  flex: 1;
}

.fp-current-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: #f5a623;
  color: #0f0f0f;
  padding: 0.15rem 0.45rem;
  border-radius: 20px;
  letter-spacing: 0.04em;
}

.fp-workouts {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.fp-workout {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
}

.fp-wo-emoji { font-size: 1rem; flex-shrink: 0; margin-top: 0.05rem; }

.fp-wo-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  flex-shrink: 0;
  width: 100px;
}

.fp-wo-day {
  font-size: 0.68rem;
  color: var(--text-3);
}

.fp-wo-type {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
}

.fp-wo-dist {
  font-size: 0.75rem;
  color: #f5a623;
  font-weight: 600;
}

.fp-wo-notes {
  font-size: 0.75rem;
  color: var(--text-2);
  line-height: 1.4;
  flex: 1;
}

/* ── Transitions ─────────────────────────────────────────────── */
.slide-up-enter-active,
.slide-up-leave-active  { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-up-enter-from    { opacity: 0; transform: translateY(100%); }
.slide-up-leave-to      { opacity: 0; transform: translateY(100%); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
