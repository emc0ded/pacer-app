import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Global styles (includes Tailwind)
import './assets/main.css'

// Mapbox base CSS — must be imported before any map is rendered
import 'mapbox-gl/dist/mapbox-gl.css'

// Fix iOS standalone PWA viewport height — CSS units (dvh, %) can differ
// from the real visual height in standalone mode. window.innerHeight is always correct.
const setAppHeight = () => {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
