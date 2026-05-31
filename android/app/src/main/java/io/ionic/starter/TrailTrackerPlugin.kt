package io.ionic.starter

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@RequiresApi(26)
@CapacitorPlugin(
    name = "TrailTracker",
    permissions = [
        Permission(
            strings = [Manifest.permission.ACCESS_FINE_LOCATION],
            alias   = "fineLocation"
        ),
        Permission(
            strings = [Manifest.permission.ACCESS_BACKGROUND_LOCATION],
            alias   = "backgroundLocation"
        ),
        Permission(
            strings = [Manifest.permission.FOREGROUND_SERVICE],
            alias   = "foregroundService"
        ),
    ]
)
class TrailTrackerPlugin : Plugin() {

    // -------------------------------------------------------------------------
    // Static instance
    //
    // TrailTrackerService needs to push position events to the JS layer.
    // notifyListeners() is protected on Plugin, so we expose a public wrapper
    // sendPosition() below and keep a static reference to this plugin instance.
    // Set in load(), cleared in handleOnDestroy() to prevent leaks.
    // -------------------------------------------------------------------------

    companion object {
        @Volatile
        var instance: TrailTrackerPlugin? = null
    }

    override fun load() {
        instance = this
    }

    /**
     * Public wrapper around the protected notifyListeners(), called by
     * TrailTrackerService to push position fixes to the JS layer.
     */
    fun sendPosition(data: JSObject) {
        notifyListeners("position", data)
    }

    // -------------------------------------------------------------------------
    // Plugin methods
    // -------------------------------------------------------------------------

    /**
     * Start the background tracking service.
     *
     * Requires ACCESS_FINE_LOCATION to be granted before calling.
     * ACCESS_BACKGROUND_LOCATION is requested here if not yet granted;
     * on Android 11+ this opens a separate system dialog.
     *
     * Expected JS call:
     *   await TrailTracker.start({ token: "...", apiBase: "..." })
     */
    @PluginMethod
    fun start(call: PluginCall) {
        val fineGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!fineGranted) {
            call.reject("ACCESS_FINE_LOCATION not granted — request permission before calling start()")
            return
        }

        // On Android 10+, background location is a separate permission that
        // must be granted through a dedicated system prompt.
        val backgroundGranted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!backgroundGranted) {
            requestPermissionForAlias("backgroundLocation", call, "backgroundLocationCallback")
            return
        }

        launchService(call)
    }

    @PermissionCallback
    fun backgroundLocationCallback(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!granted) {
            call.reject("ACCESS_BACKGROUND_LOCATION denied — tracking will not survive screen lock")
            return
        }

        launchService(call)
    }

    /**
     * Stop the background tracking service.
     *
     * Expected JS call:
     *   await TrailTracker.stop()
     */
    @PluginMethod
    fun stop(call: PluginCall) {
        val intent = Intent(context, TrailTrackerService::class.java)
        context.stopService(intent)
        call.resolve()
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private fun launchService(call: PluginCall) {
        val intent = Intent(context, TrailTrackerService::class.java).apply {
            putExtra("token",   call.getString("token")   ?: "")
            putExtra("apiBase", call.getString("apiBase") ?: "")
        }
        context.startForegroundService(intent)
        call.resolve()
    }

    override fun handleOnDestroy() {
        instance = null
        super.handleOnDestroy()
    }
}
