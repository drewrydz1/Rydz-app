import UIKit
import Capacitor
import WebKit
import CoreLocation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
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

// MARK: - JS Bridge

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

// MARK: - Background Location Manager

class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {

    static let shared = BackgroundLocationManager()

    private let locationManager = CLLocationManager()
    private var driverId: String?
    private var lastUpdateTime: Date = .distantPast
    private let updateInterval: TimeInterval = 10

    private let supabaseURL = "https://ewnynyazfkcyqakyuzcd.supabase.co"
    private let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c"

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
    }

    func startTracking(driverId: String) {
        self.driverId = driverId

        let status = locationManager.authorizationStatus
        if status == .notDetermined {
            locationManager.requestAlwaysAuthorization()
        } else if status == .authorizedWhenInUse {
            locationManager.requestAlwaysAuthorization()
        }

        locationManager.startUpdatingLocation()
        print("[RydzLocation] Started background tracking for driver: \(driverId)")
    }

    func stopTracking() {
        locationManager.stopUpdatingLocation()
        if let did = driverId {
            updateSupabase(driverId: did, lat: nil, lng: nil)
        }
        driverId = nil
        print("[RydzLocation] Stopped background tracking")
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last, let did = driverId else { return }

        let now = Date()
        guard now.timeIntervalSince(lastUpdateTime) >= updateInterval else { return }
        lastUpdateTime = now

        updateSupabase(driverId: did, lat: location.coordinate.latitude, lng: location.coordinate.longitude)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[RydzLocation] Error: \(error.localizedDescription)")
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            if driverId != nil { manager.startUpdatingLocation() }
        }
    }

    private func updateSupabase(driverId: String, lat: Double?, lng: Double?) {
        let encodedId = driverId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? driverId
        guard let url = URL(string: "\(supabaseURL)/rest/v1/users?id=eq.\(encodedId)") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [:]
        if let lat = lat, let lng = lng {
            body["lat"] = lat
            body["lng"] = lng
        } else {
            body["lat"] = NSNull()
            body["lng"] = NSNull()
        }

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: request) { _, _, error in
            if let error = error { print("[RydzLocation] Supabase error: \(error.localizedDescription)") }
        }.resume()
    }
}
