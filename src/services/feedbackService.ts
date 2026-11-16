/**
 * feedbackService.ts — Tells the user that a change was saved or refused: a short toast at the
 * bottom of the screen and, in the Android app, a light vibration (a stronger one for a refusal).
 * The browser gets the toast only. A failure to vibrate is ignored.
 * Does not own: the inline error texts of the forms, which stay where the error happened.
 */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { toastController } from "@ionic/vue";

/** How long a toast stays, in milliseconds. */
const TOAST_MS = 2500;

/**
 * Shows a toast and, on Android, vibrates.
 *
 * @param message - The sentence to show
 * @param kind - `success` for a saved change, `error` for a refusal
 */
export async function notify(message: string, kind: "success" | "error" = "success"): Promise<void> {
    if (Capacitor.isNativePlatform()) {
        const vibration = kind === "success"
            ? Haptics.impact({ style: ImpactStyle.Light })
            : Haptics.notification({ type: NotificationType.Error });
        vibration.catch(() => undefined);
    }
    const toast = await toastController.create({
        message,
        duration: TOAST_MS,
        position: "bottom",
        cssClass: `kishin-toast kishin-toast-${kind}`,
    });
    await toast.present();
}
