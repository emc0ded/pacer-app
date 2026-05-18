<template>
  <div class="profile-view">
    <div class="view-header">
      <span class="wordmark">PACER</span>
      <h1 class="view-title">Profile</h1>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="authStore.loading" class="loading-state">Loading…</div>

    <!-- ── Signed out ─────────────────────────────────────────── -->
    <div v-else-if="!authStore.isAuthenticated" class="auth-card">
      <div class="auth-icon">👤</div>
      <p class="auth-heading">Sign in to sync your runs</p>
      <p class="auth-sub">Your runs are saved locally until you sign in.</p>
      <button class="google-btn" :disabled="signingIn" @click="handleGoogleSignIn">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {{ signingIn === 'google' ? 'Signing in…' : 'Sign in with Google' }}
      </button>
      <button class="apple-btn" :disabled="!!signingIn" @click="handleAppleSignIn">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.39-1.32 2.76-2.54 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        {{ signingIn === 'apple' ? 'Signing in…' : 'Sign in with Apple' }}
      </button>
      <p v-if="signInError" class="error-msg">{{ signInError }}</p>
    </div>

    <!-- ── Signed in ──────────────────────────────────────────── -->
    <template v-else>
      <!-- User card with tappable avatar -->
      <div class="user-card">
        <div class="avatar-wrapper" @click="triggerUpload">
          <div class="avatar">
            <img
              v-if="displayPhoto"
              :src="displayPhoto"
              :alt="authStore.displayName"
              referrerpolicy="no-referrer"
            />
            <span v-else class="avatar-initials">{{ initials }}</span>
          </div>
        </div>
        <div class="user-info">
          <span class="user-name">{{ authStore.displayName }}</span>
          <span class="user-email">{{ authStore.email }}</span>
          <span v-if="uploading" class="upload-status">Uploading…</span>
          <span v-if="uploadError" class="upload-error">{{ uploadError }}</span>
        </div>
        <!-- Hidden file input -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          style="display:none"
          @change="handlePhotoUpload"
        />
      </div>

      <!-- Settings -->
      <div class="settings-section">
        <div class="section-label">Settings</div>

        <!-- Dark mode -->
        <div class="settings-row">
          <span class="settings-row-label">Dark mode</span>
          <button
            class="toggle-btn"
            :class="{ on: themeStore.theme === 'dark' }"
            :aria-pressed="themeStore.theme === 'dark'"
            @click="themeStore.toggle()"
          >
            <span class="toggle-thumb" />
          </button>
        </div>

        <!-- Weekly goal -->
        <div class="settings-row">
          <span class="settings-row-label">Weekly goal</span>
          <div class="goal-input-wrap">
            <input
              type="number"
              min="0"
              max="200"
              class="goal-input"
              :value="settingsStore.weeklyGoalMi"
              @change="handleGoalChange"
            />
            <span class="goal-unit">mi</span>
          </div>
        </div>
      </div>

      <!-- Lifetime stats -->
      <div class="stats-section">
        <div class="section-label">Lifetime Stats</div>
        <div class="lifetime-stats">
          <div class="lt-stat">
            <span class="lt-val">{{ (runStore.totalKm * 0.621371).toFixed(1) }}</span>
            <span class="lt-lbl">mi total</span>
          </div>
          <div class="lt-stat">
            <span class="lt-val">{{ runStore.totalRuns }}</span>
            <span class="lt-lbl">runs</span>
          </div>
          <div class="lt-stat">
            <span class="lt-val">{{ bestPaceDisplay }}</span>
            <span class="lt-lbl">best pace</span>
          </div>
          <div class="lt-stat">
            <span class="lt-val">{{ (runStore.longestRunKm * 0.621371).toFixed(1) }}</span>
            <span class="lt-lbl">longest mi</span>
          </div>
        </div>
      </div>

      <!-- Achievements -->
      <div class="achievements-section">
        <div class="section-label">
          Achievements
          <span class="achievement-count">
            {{ runStore.unlockedCount }} / {{ runStore.achievements.length }}
          </span>
        </div>
        <div class="achievements-grid">
          <div
            v-for="achievement in runStore.achievements"
            :key="achievement.id"
            class="achievement-card"
            :class="{ locked: !achievement.unlocked }"
          >
            <span class="achievement-emoji">{{ achievement.emoji }}</span>
            <span class="achievement-name">{{ achievement.name }}</span>
            <span class="achievement-desc">{{ achievement.description }}</span>
            <span v-if="!achievement.unlocked" class="lock-icon">🔒</span>
          </div>
        </div>
      </div>

      <!-- Sign out -->
      <button class="sign-out-btn" @click="handleSignOut">Sign Out</button>
    </template>

    <!-- App info -->
    <div class="app-info">
      <span>Pacer v0.1.0</span>
      <span>·</span>
      <span>CS Capstone 2026</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, setDoc } from 'firebase/firestore'
import { useAuthStore } from '@/stores/auth'
import { useRunStore } from '@/stores/run'
import { useThemeStore } from '@/stores/theme'
import { useSettingsStore } from '@/stores/settings'
import { storage, db } from '@/firebase'

const authStore     = useAuthStore()
const runStore      = useRunStore()
const themeStore    = useThemeStore()
const settingsStore = useSettingsStore()

// ── Sign in / out ──────────────────────────────────────────────
const signingIn   = ref(null) // 'google' | 'apple' | null
const signInError = ref('')

async function handleGoogleSignIn() {
  signingIn.value   = 'google'
  signInError.value = ''
  try {
    await authStore.signInWithGoogle()
  } catch {
    signInError.value = 'Google sign-in failed. Please try again.'
  } finally {
    signingIn.value = null
  }
}

async function handleAppleSignIn() {
  signingIn.value   = 'apple'
  signInError.value = ''
  try {
    await authStore.signInWithApple()
  } catch {
    signInError.value = 'Apple sign-in failed. Please try again.'
  } finally {
    signingIn.value = null
  }
}

async function handleSignOut() {
  await authStore.signOut()
}

// ── Initials ───────────────────────────────────────────────────
const initials = computed(() => {
  const name = authStore.displayName
  if (!name || name === 'Runner') return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
})

// ── Profile photo ──────────────────────────────────────────────
// Custom photo (from Storage) takes precedence over Google photo
const customPhotoURL = ref(authStore.customPhotoURL ?? null)

const displayPhoto = computed(() =>
  customPhotoURL.value || authStore.photoURL,
)

const fileInput    = ref(null)
const uploading    = ref(false)
const uploadError  = ref('')

function triggerUpload() {
  fileInput.value?.click()
}

async function handlePhotoUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !authStore.uid) return

  uploading.value   = true
  uploadError.value = ''

  try {
    // Upload to Firebase Storage
    const photoRef = storageRef(storage, `users/${authStore.uid}/profile.jpg`)
    await uploadBytes(photoRef, file, { contentType: file.type })

    // Get the public download URL
    const url = await getDownloadURL(photoRef)

    // Persist URL to Firestore so it survives across sessions
    await setDoc(
      doc(db, 'users', authStore.uid),
      { customPhotoURL: url },
      { merge: true },
    )

    customPhotoURL.value = url
    authStore.setCustomPhoto(url)
  } catch (err) {
    uploadError.value = err.code || err.message || 'Upload failed.'
  } finally {
    uploading.value = false
    // Reset input so the same file can be re-selected
    event.target.value = ''
  }
}

// ── Weekly goal ────────────────────────────────────────────────
function handleGoalChange(e) {
  settingsStore.saveGoal(authStore.uid, e.target.value)
}

// ── Best pace display ──────────────────────────────────────────
const bestPaceDisplay = computed(() => {
  const p = runStore.bestPaceMinPerKm
  if (p === null) return '—'
  const pm = Math.floor(p)
  const ps = Math.round((p - pm) * 60)
  return `${pm}:${String(ps).padStart(2, '0')}`
})
</script>

<style scoped>
.profile-view {
  flex: 1;
  overflow-y: auto;
  padding: calc(env(safe-area-inset-top) + 1.5rem) 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--bg);
}

.view-header { display: flex; flex-direction: column; gap: 0.25rem; }
.wordmark    { font-size: 0.65rem; font-weight: 800; letter-spacing: 0.2em; color: #f5a623; }
.view-title  { margin: 0; font-size: 1.6rem; font-weight: 700; color: var(--text); }
.loading-state { color: var(--text-2); font-size: 0.9rem; padding: 2rem 0; text-align: center; }

/* Auth card */
.auth-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 2rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}
.auth-icon    { font-size: 2.5rem; }
.auth-heading { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text); }
.auth-sub     { margin: 0; font-size: 0.82rem; color: var(--text-2); line-height: 1.5; }
.google-btn {
  display: flex; align-items: center; gap: 0.6rem;
  background: #fff; color: #111; border: none; border-radius: 12px;
  padding: 0.75rem 1.25rem; font-size: 0.9rem; font-weight: 600;
  cursor: pointer; margin-top: 0.5rem; transition: opacity 0.15s;
}
.google-btn:active   { opacity: 0.8; }
.google-btn:disabled { opacity: 0.5; cursor: default; }

.apple-btn {
  display: flex; align-items: center; gap: 0.6rem;
  background: #000; color: #fff; border: none; border-radius: 12px;
  padding: 0.75rem 1.25rem; font-size: 0.9rem; font-weight: 600;
  cursor: pointer; transition: opacity 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.apple-btn:active   { opacity: 0.8; }
.apple-btn:disabled { opacity: 0.5; cursor: default; }

.error-msg { margin: 0; font-size: 0.8rem; color: #ff453a; }

/* User card */
.user-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--divider);
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar img        { width: 100%; height: 100%; object-fit: cover; }
.avatar-initials   { font-size: 1.2rem; font-weight: 700; color: #f5a623; }


.user-info { display: flex; flex-direction: column; gap: 0.2rem; }
.user-name { font-size: 1rem; font-weight: 600; color: var(--text); }
.user-email { font-size: 0.8rem; color: var(--text-2); }
.upload-status { font-size: 0.75rem; color: #f5a623; }
.upload-error  { font-size: 0.75rem; color: #ff453a; }

/* Settings section (Appearance) */
.settings-section  { display: flex; flex-direction: column; gap: 0.75rem; }

.settings-row {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-row-label {
  font-size: 0.95rem;
  color: var(--text);
}

/* iOS-style toggle */
.toggle-btn {
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: none;
  padding: 3px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.toggle-btn.on {
  background: #f5a623;
}

.toggle-thumb {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(0);
}

.toggle-btn.on .toggle-thumb {
  transform: translateX(20px);
}

/* Weekly goal input */
.goal-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.goal-input {
  width: 64px;
  padding: 0.35rem 0.5rem;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
}

.goal-input::-webkit-outer-spin-button,
.goal-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.goal-input:focus {
  outline: none;
  border-color: #f5a623;
}

.goal-unit {
  font-size: 0.85rem;
  color: var(--text-2);
}

/* Stats */
.stats-section     { display: flex; flex-direction: column; gap: 0.75rem; }
.section-label {
  font-size: 0.75rem; font-weight: 700; color: var(--text-2);
  text-transform: uppercase; letter-spacing: 0.08em;
  display: flex; align-items: center; justify-content: space-between;
}
.achievement-count {
  background: var(--bg-elevated);
  color: #f5a623;
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 20px;
}
.lifetime-stats    { display: flex; gap: 0.6rem; }
.lt-stat {
  flex: 1;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 0.85rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}
.lt-val { font-size: 1.2rem; font-weight: 700; color: #f5a623; font-variant-numeric: tabular-nums; }
.lt-lbl { font-size: 0.6rem; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }

/* Achievements */
.achievements-section { display: flex; flex-direction: column; gap: 0.75rem; }

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.achievement-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 0.85rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  position: relative;
  text-align: center;
  border: 1px solid transparent;
  transition: border-color 0.2s;
}

.achievement-card:not(.locked) {
  border-color: rgba(245, 166, 35, 0.25);
}

.achievement-card.locked {
  opacity: 0.4;
}

.achievement-emoji { font-size: 1.6rem; }
.achievement-name  { font-size: 0.7rem; font-weight: 700; color: var(--text); }
.achievement-desc  { font-size: 0.6rem; color: var(--text-2); line-height: 1.3; }

.lock-icon {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  font-size: 0.65rem;
  opacity: 0.6;
}

/* Sign out */
.sign-out-btn {
  width: 100%;
  padding: 0.9rem;
  background: var(--bg-elevated);
  color: #ff453a;
  border: none;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.sign-out-btn:active { opacity: 0.7; }

/* App info */
.app-info {
  display: flex; gap: 0.5rem; justify-content: center;
  font-size: 0.75rem; color: var(--text-4);
  margin-top: auto; padding-top: 0.5rem;
}
</style>
