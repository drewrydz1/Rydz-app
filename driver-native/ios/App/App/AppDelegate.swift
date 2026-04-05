import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Inject JS bridge after WebView loads
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.setupJSBridge()
        }
        return true
    }

    private func setupJSBridge() {
        guard let vc = window?.rootViewController as? CAPBridgeViewController,
              let webView = vc.webView else { return }

        let handler = LocationMessageHandler()
        webView.configuration.userContentController.add(handler, name: "rydzLocation")
        print("[Rydz] JS bridge registered")
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {}

    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {
        BackgroundLocationManager.shared.stopTracking()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

/// Handles messages from JS: window.webkit.messageHandlers.rydzLocation.postMessage(...)
class LocationMessageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        if action == "start", let driverId = body["driverId"] as? String {
            BackgroundLocationManager.shared.startTracking(driverId: driverId)
        } else if action == "stop" {
            BackgroundLocationManager.shared.stopTracking()
        }
    }
}
