import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/run',
      name: 'run',
      component: () => import('@/views/RunView.vue'),
    },
    {
      path: '/routes',
      name: 'routes',
      component: () => import('@/views/RoutesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/history/:id',
      name: 'run-detail',
      component: () => import('@/views/RunDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      // Profile handles its own signed-out state — no hard redirect needed
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Navigation guard — only blocks routes marked requiresAuth
router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true

  const authStore = useAuthStore()

  // If Firebase hasn't resolved the session yet, let it through —
  // the view itself can show a loading state
  if (authStore.loading) return true

  // Redirect unauthenticated users to profile so they can sign in
  if (!authStore.isAuthenticated) {
    return { name: 'profile', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
