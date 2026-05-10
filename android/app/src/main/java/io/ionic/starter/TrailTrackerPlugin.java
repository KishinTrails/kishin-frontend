package io.ionic.starter;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;

import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@RequiresApi(api = 26)
@CapacitorPlugin(
        name = "TrailTracker",
        permissions = {
                @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}),
                @Permission(strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION}),
                @Permission(strings = {Manifest.permission.FOREGROUND_SERVICE}),
        }
)
public class TrailTrackerPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        boolean fineGranted = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;

        if (!fineGranted) {
            call.reject("Location permission not granted");
            return;
        }

        String token = call.getString("token", "");
        String apiBase = call.getString("apiBase", "");

        Intent intent = new Intent(getContext(), TrailTrackerService.class);
        intent.putExtra("token", token);
        intent.putExtra("apiBase", apiBase);

        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), TrailTrackerService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}