<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="login-container" :class="theme">
        <div class="login-card">
          <h1>Kishin</h1>
          <p class="subtitle">
            Sign in to continue
          </p>

          <form @submit.prevent="handleLogin">
            <ion-item>
              <ion-label position="stacked">
                Username
              </ion-label>
              <ion-input
                v-model="username"
                type="text"
                autocomplete="username"
                required
              />
            </ion-item>

            <ion-item>
              <ion-label position="stacked">
                Password
              </ion-label>
              <ion-input
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
              />
            </ion-item>

            <div
              v-if="errorMessage"
              class="error-message"
            >
              {{ errorMessage }}
            </div>

            <ion-button
              type="submit"
              expand="block"
              :disabled="isLoading"
            >
              <ion-spinner
                v-if="isLoading"
                name="dots"
              />
              <span v-else>Sign In</span>
            </ion-button>

            <div
              v-if="loadingMessage"
              class="loading-message"
            >
              {{ loadingMessage }}
            </div>
          </form>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/**
 * LoginPage - User authentication page.
 * Provides a form for users to log in with username and password.
 */

import { ref } from 'vue';
import { IonPage, IonContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { login } from '@/services/authService';
import { loadMapStyle, styleToThemeClass } from '@/services/mapStyleService';
import { isPrefetchDone } from '@/services/cacheService';
import { prefetchAllCells } from '@/services/poiService';

const router = useRouter();

const theme = styleToThemeClass(loadMapStyle());

const username = ref('');
const password = ref('');
const isLoading = ref(false);
const loadingMessage = ref('');
const errorMessage = ref('');

/**
 * Handle login form submission.
 * Calls the authentication service and redirects on success.
 */
const handleLogin = async () => {
  errorMessage.value = '';
  isLoading.value = true;
  loadingMessage.value = '';

  try {
    await login(username.value, password.value);
    if (!isPrefetchDone()) {
      loadingMessage.value = 'Syncing map data…';
      await prefetchAllCells();
    }
    router.replace('/map');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed';
  } finally {
    isLoading.value = false;
    loadingMessage.value = '';
  }
};
</script>

<style scoped>
/* ── Theme tokens ────────────────────────────────────────────────────────────
   Defined on .login-container so all descendants inherit via var().          */
.theme-standard {
  --c-page-bg:       #f5f5f5;
  --c-card-bg:       white;
  --c-card-border:   transparent;
  --c-card-shadow:   0 4px 20px rgba(0, 0, 0, 0.1);
  --c-title:         #333;
  --c-subtitle:      #666;
  --c-input-border:  #ddd;
  --c-input-text:    #333;
  --c-placeholder:   #999;
  --c-btn-bg:        #333;
  --c-btn-bg-hover:  #444;
  --c-btn-text:      white;
  --c-error-text:    #e74c3c;
  --c-error-bg:      #fdeaea;
}

/* ukiyo-e palette: washi paper / sumi ink / prussian blue / ochre / parchment */
.theme-ukiyo {
  --c-page-bg:       #1A2B4D;
  --c-card-bg:       #E8D5A3;
  --c-card-border:   #B4A07A;
  --c-card-shadow:   0 4px 24px rgba(10, 17, 30, 0.5);
  --c-title:         #1A2B4D;
  --c-subtitle:      #6B5A3E;
  --c-input-border:  #B4A07A;
  --c-input-text:    #1A2B4D;
  --c-placeholder:   #8B7A5A;
  --c-btn-bg:        #4A6B8A;
  --c-btn-bg-hover:  #3A5570;
  --c-btn-text:      #E8D5A3;
  --c-error-text:    #8B6914;
  --c-error-bg:      #F0E4BB;
}

/* ── Layout ──────────────────────────────────────────────────────────────── */
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  background: var(--c-page-bg);
  transition: background-color 0.3s;
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: var(--c-card-bg);
  border: 1px solid var(--c-card-border);
  border-radius: 12px;
  padding: 30px;
  box-shadow: var(--c-card-shadow);
  transition: background-color 0.3s, border-color 0.3s;
}

h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  color: var(--c-title);
}

.subtitle {
  margin: 8px 0 24px;
  text-align: center;
  color: var(--c-subtitle);
  font-size: 14px;
}

ion-item {
  --background: transparent;
  --padding-start: 0;
  --padding-end: 0;
  margin-bottom: 16px;
  --border-color: var(--c-input-border);
  --color: var(--c-input-text);
}

ion-input {
  --color: var(--c-input-text);
  --placeholder-color: var(--c-placeholder);
}

ion-button {
  margin-top: 24px;
  --background: var(--c-btn-bg);
  --background-activated: var(--c-btn-bg-hover);
  --color: var(--c-btn-text);
}

.error-message {
  color: var(--c-error-text);
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
  padding: 10px;
  background: var(--c-error-bg);
  border-radius: 6px;
}

.loading-message {
  font-size: 13px;
  text-align: center;
  margin-top: 12px;
  color: var(--c-subtitle);
}
</style>
