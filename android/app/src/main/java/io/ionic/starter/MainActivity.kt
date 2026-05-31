package io.ionic.starter

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * Application entry-point activity.
 *
 * Extends Capacitor's [BridgeActivity], which hosts the WebView and wires
 * the JS/native bridge. [TrailTrackerPlugin] is registered here before
 * [super.onCreate] so it is available to the WebView from the moment the
 * bridge initialises.
 */
class MainActivity : BridgeActivity() {

    /**
     * Register native plugins and hand off to the Capacitor bridge.
     *
     * [TrailTrackerPlugin] must be registered before [super.onCreate] is
     * called; the bridge scans registered plugins during its own initialisation
     * and will not pick up plugins added afterwards.
     *
     * @param savedInstanceState Saved instance state bundle from the OS, or null on first launch.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(TrailTrackerPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}