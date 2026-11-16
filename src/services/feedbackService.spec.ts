import { describe, it, expect, vi, beforeEach } from 'vitest';

const present = vi.fn();
const native = { value: false };

vi.mock('@ionic/vue', () => ({
  toastController: { create: vi.fn(async () => ({ present })) },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.value },
}));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn(async () => undefined), notification: vi.fn(async () => { throw new Error('no motor'); }) },
  ImpactStyle: { Light: 'LIGHT' },
  NotificationType: { Error: 'ERROR' },
}));

import { toastController } from '@ionic/vue';
import { Haptics } from '@capacitor/haptics';
import { notify } from './feedbackService';

describe('notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.value = false;
  });

  it('shows a toast without vibrating in the browser', async () => {
    await notify('Foo done.');
    expect(toastController.create).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Foo done.', cssClass: 'kishin-toast kishin-toast-success',
    }));
    expect(present).toHaveBeenCalled();
    expect(Haptics.impact).not.toHaveBeenCalled();
  });

  it('vibrates lightly for a saved change in the app', async () => {
    native.value = true;
    await notify('Foo done.');
    expect(Haptics.impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('shows a refusal even when vibrating fails', async () => {
    native.value = true;
    await notify('Bar refused.', 'error');
    expect(Haptics.notification).toHaveBeenCalledWith({ type: 'ERROR' });
    expect(toastController.create).toHaveBeenCalledWith(expect.objectContaining({ cssClass: 'kishin-toast kishin-toast-error' }));
    expect(present).toHaveBeenCalled();
  });
});
