<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="login-container">
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

const router = useRouter();

const username = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMessage = ref('');

/**
 * Handle login form submission.
 * Calls the authentication service and redirects on success.
 */
const handleLogin = async () => {
  errorMessage.value = '';
  isLoading.value = true;

  try {
    await login(username.value, password.value);
    router.replace('/map');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  background: #f5f5f5;
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  text-align: center;
  color: #333;
}

.subtitle {
  margin: 8px 0 24px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

ion-item {
  --background: transparent;
  --padding-start: 0;
  --padding-end: 0;
  margin-bottom: 16px;
  --border-color: #ddd;
  --color: #333;
}

ion-input {
  --color: #333;
  --placeholder-color: #999;
}

ion-button {
  margin-top: 24px;
  --background: #333;
  --background-activated: #444;
  --color: white;
}

.error-message {
  color: #e74c3c;
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
  padding: 10px;
  background: #fdeaea;
  border-radius: 6px;
}
</style>
