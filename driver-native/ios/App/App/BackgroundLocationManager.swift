import Foundation
import CoreLocation

/// Native background location manager for Rydz Driver
/// Continues tracking GPS when app is backgrounded and sends updates to Supabase
class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {

    static let shared = BackgroundLocationManager()

    private let locationManager = CLLocationManager()
    private var driverId: String?
    private var lastUpdateTime: Date = .distantPast
    private let updateInterval: TimeInterval = 10 // seconds

    private let supabaseURL = "https://ewnynyazfkcyqakyuzcd.supabase.co"
    private let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c"

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10 // meters
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
    }

    /// Start background tracking for a specific driver
    func startTracking(driverId: String) {
        self.driverId = driverId

        let status = locationManager.authorizationStatus
        if status == .notDetermined {
            locationManager.requestAlwaysAuthorization()
        } else if status == .authorizedWhenInUse {
            // Upgrade to always
            locationManager.requestAlwaysAuthorization()
        }

        locationManager.startUpdatingLocation()
        print("[RydzLocation] Started background tracking for driver: \(driverId)")
    }

    /// Stop background tracking
    func stopTracking() {
        locationManager.stopUpdatingLocation()

        // Clear location in Supabase
        if let did = driverId {
            updateSupabase(driverId: did, lat: nil, lng: nil)
        }
        driverId = nil
        print("[RydzLocation] Stopped background tracking")
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last, let did = driverId else { return }

        let now = Date()
        guard now.timeIntervalSince(lastUpdateTime) >= updateInterval else { return }
        lastUpdateTime = now

        let lat = location.coordinate.latitude
        let lng = location.coordinate.longitude

        updateSupabase(driverId: did, lat: lat, lng: lng)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[RydzLocation] Error: \(error.localizedDescription)")
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        print("[RydzLocation] Authorization changed: \(status.rawValue)")

        if status == .authorizedAlways || status == .authorizedWhenInUse {
            if driverId != nil {
                manager.startUpdatingLocation()
            }
        }
    }

    // MARK: - Supabase API

    private func updateSupabase(driverId: String, lat: Double?, lng: Double?) {
        let encodedId = driverId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? driverId
        let urlString = "\(supabaseURL)/rest/v1/users?id=eq.\(encodedId)"

        guard let url = URL(string: urlString) else { return }

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

        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                print("[RydzLocation] Supabase error: \(error.localizedDescription)")
            }
        }.resume()
    }
}
