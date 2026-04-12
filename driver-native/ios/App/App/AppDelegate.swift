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

    // MARK: - Push Notifications

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
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

        let lat = location.coordinate.latitude
        let lng = location.coordinate.longitude
        updateSupabase(driverId: did, lat: lat, lng: lng)
        checkPickupGeofence(driverId: did, driverLat: lat, driverLng: lng)
    }

    // Haversine distance in meters
    private func haversine(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
        let R = 6371000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLng = (lng2 - lng1) * .pi / 180
        let a = sin(dLat/2) * sin(dLat/2) +
                cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) *
                sin(dLng/2) * sin(dLng/2)
        return R * 2 * atan2(sqrt(a), sqrt(1-a))
    }

    // Fetch active accepted ride for this driver, compute distance to pickup,
    // and if within 500ft (152m) PATCH its status to 'arrived' which triggers
    // the rides-UPDATE webhook -> push to rider.
    private func checkPickupGeofence(driverId: String, driverLat: Double, driverLng: Double) {
        let encodedId = driverId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? driverId
        guard let url = URL(string: "\(supabaseURL)/rest/v1/rides?driver_id=eq.\(encodedId)&status=eq.accepted&select=id,pu_x,pu_y&limit=1") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")

        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                  let row = arr.first,
                  let rideId = row["id"] as? String else { return }

            var puLat: Double? = nil
            var puLng: Double? = nil
            if let x = row["pu_x"] as? Double { puLat = x }
            else if let s = row["pu_x"] as? String { puLat = Double(s) }
            if let y = row["pu_y"] as? Double { puLng = y }
            else if let s = row["pu_y"] as? String { puLng = Double(s) }
            guard let pLat = puLat, let pLng = puLng else { return }

            let flagKey = "rydz-nearby-\(rideId)"
            if UserDefaults.standard.string(forKey: flagKey) == "1" { return }

            let dist = self.haversine(driverLat, driverLng, pLat, pLng)
            if dist <= 152 {
                UserDefaults.standard.set("1", forKey: flagKey)
                self.setRideArrived(rideId: rideId)
            }
        }.resume()
    }

    private func setRideArrived(rideId: String) {
        let encoded = rideId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? rideId
        guard let url = URL(string: "\(supabaseURL)/rest/v1/rides?id=eq.\(encoded)") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["status": "arrived"])
        URLSession.shared.dataTask(with: req) { _, _, err in
            if let err = err { print("[RydzLocation] setArrived error: \(err.localizedDescription)") }
            else { print("[RydzLocation] ride \(rideId) auto-arrived (geofence)") }
        }.resume()
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
