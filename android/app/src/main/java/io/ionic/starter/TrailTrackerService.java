package io.ionic.starter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class TrailTrackerService extends Service {

    private static final String TAG = "TrailTrackerService";
    private static final int NOTIFICATION_ID = 1;
    private static final String CHANNEL_ID = "trail_tracker";
    private static final long INTERVAL_MS = 30_000L;

    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private okhttp3.OkHttpClient okHttp;
    private PowerManager.WakeLock wakeLock;

    private String token = "";
    private String apiBase = "";
    private long lastProcessedMs = 0L;

    @RequiresApi(api = Build.VERSION_CODES.O)
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            token = intent.getStringExtra("token") != null ? intent.getStringExtra("token") : "";
            apiBase = intent.getStringExtra("apiBase") != null ? intent.getStringExtra("apiBase") : "";
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        acquireWakeLock();
        startLocationUpdates();
        return START_STICKY;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        fusedClient = LocationServices.getFusedLocationProviderClient(this);
        okHttp = new okhttp3.OkHttpClient();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                android.location.Location location = result.getLastLocation();
                if (location == null) return;

                long now = System.currentTimeMillis();
                if (now - lastProcessedMs < INTERVAL_MS) return;
                lastProcessedMs = now;

                String cell = location.getLatitude() + "," + location.getLongitude();
                logCell(cell);
            }
        };
    }

    private void startLocationUpdates() {
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5_000L)
                .setMinUpdateIntervalMillis(5_000L)
                .build();

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission missing", e);
        }
    }

    private void logCell(String cell) {
        if (cell.isEmpty()) return;

        String url = apiBase + "/trails/explored?cell=" + cell;
        Request.Builder builder = new Request.Builder()
                .url(url)
                .post(RequestBody.create(null, new byte[0]));

        if (!token.isEmpty()) {
            builder.header("Authorization", "Bearer " + token);
        }

        okHttp.newCall(builder.build()).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "API call failed: " + e.getMessage());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                response.close();
                Log.d(TAG, "Logged cell " + cell + " -> " + response.code());
            }
        });
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    private Notification buildNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Trail Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            manager.createNotificationChannel(channel);
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Trail Tracking Active")
                .setContentText("Kishin Trails is recording your trail.")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .build();
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TrailTracker::WakeLock");
        wakeLock.acquire();
    }

    @Override
    public void onDestroy() {
        if (fusedClient != null) {
            fusedClient.removeLocationUpdates(locationCallback);
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
