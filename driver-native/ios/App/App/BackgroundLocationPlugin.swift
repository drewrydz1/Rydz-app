import Capacitor

/// Capacitor plugin to bridge JS <-> native background location
@objc(BackgroundLocationPlugin)
public class BackgroundLocationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackgroundLocationPlugin"
    public let jsName = "BackgroundLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTracking", returnType: CAPPluginReturnPromise)
    ]

    @objc func startTracking(_ call: CAPPluginCall) {
        guard let driverId = call.getString("driverId") else {
            call.reject("driverId is required")
            return
        }

        DispatchQueue.main.async {
            BackgroundLocationManager.shared.startTracking(driverId: driverId)
        }

        call.resolve(["started": true])
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            BackgroundLocationManager.shared.stopTracking()
        }

        call.resolve(["stopped": true])
    }
}
