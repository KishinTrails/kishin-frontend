package io.kishintrails.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import com.getcapacitor.JSObject
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.common.geometry.S2CellId
import com.google.common.geometry.S2LatLng
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.Response
import okhttp3.MediaType.Companion.toMediaType
import java.io.IOException

class TrailTrackerService : Service() {

    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var okHttp: OkHttpClient

    private var token = ""
    private var apiBase = ""
    private var lastJsNotifyMs = 0L
    private var lastApiCallMs = 0L

    private val jsIntervalMs  =  2_000L   // how often the Vue layer receives a position update
    private val apiIntervalMs = 20_000L   // how often we POST to the remote API

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        okHttp = OkHttpClient()

        locationCallback = object : LocationCallback() {
            @RequiresApi(26)
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                val now = System.currentTimeMillis()

                if (now - lastJsNotifyMs >= jsIntervalMs) {
                    lastJsNotifyMs = now
                    TrailTrackerPlugin.instance?.sendPosition(
                        JSObject().apply {
                            put("latitude", location.latitude)
                            put("longitude", location.longitude)
                            put("accuracy", location.accuracy)
                            put("timestamp", now)
                        }
                    )
                }

                if (now - lastApiCallMs >= apiIntervalMs) {
                    lastApiCallMs = now
                    logCell(latLngToS2Token(location.latitude, location.longitude, 16))
                }
            }
        }
    }

    @RequiresApi(26)
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token   = intent?.getStringExtra("token")   ?: ""
        apiBase = intent?.getStringExtra("apiBase") ?: ""

        startForeground(NOTIFICATION_ID, buildNotification())
        startLocationUpdates()

        // START_STICKY ensures Android restarts the service if it is killed,
        // passing a null intent.  onStartCommand handles null gracefully above.
        return START_STICKY
    }

    override fun onDestroy() {
        fusedClient.removeLocationUpdates(locationCallback)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?) = null

    // -------------------------------------------------------------------------
    // Location
    // -------------------------------------------------------------------------

    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2_000L)
            .setMinUpdateIntervalMillis(2_000L)
            .build()

        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission missing — service cannot track", e)
            stopSelf()
        }
    }

    private fun latLngToS2Token(lat: Double, lng: Double, level: Int): String {
        val latLng = S2LatLng.fromDegrees(lat, lng)
        return S2CellId.fromLatLng(latLng).parent(level).toToken()
    }

    // -------------------------------------------------------------------------
    // API reporting
    // -------------------------------------------------------------------------

    /**
     * POST the S2 cell token to the remote API.
     * Runs entirely on OkHttp's background thread pool — no UI thread involvement.
     */
    private fun logCell(cell: String) {
        val url = "$apiBase/trails/explored"
        val json = """{"cells":["$cell"]}"""
        val body = RequestBody.create("application/json".toMediaType(), json)
        val request = Request.Builder()
            .url(url)
            .post(body)
            .apply { if (token.isNotEmpty()) header("Authorization", "Bearer $token") }
            .build()

        okHttp.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to log cell $cell: ${e.message}")
            }
            override fun onResponse(call: Call, response: Response) {
                response.close()
                Log.d(TAG, "Logged cell $cell → HTTP ${response.code}")
            }
        })
    }

    // -------------------------------------------------------------------------
    // Notification
    // -------------------------------------------------------------------------

    @RequiresApi(26)
    private fun buildNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Trail Tracking",
                    NotificationManager.IMPORTANCE_LOW
                )
            )
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Trail Tracking Active")
            .setContentText("Kishin Trails is recording your trail.")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    companion object {
        private const val TAG             = "TrailTrackerService"
        private const val CHANNEL_ID      = "trail_tracker"
        private const val NOTIFICATION_ID = 1
    }
}
