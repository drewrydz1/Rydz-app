import Foundation
import Capacitor
import CoreLocation
import MapKit

@objc(RydzLocation)
public class RydzLocation: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {

    public let identifier = "RydzLocationPlugin"
    public let jsName = "RydzLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearRide", returnType: CAPPluginReturnPromise)
    ]

    private let locMgr = CLLocationManager()
    private var driverId: String?
    private var supaUrl: String?
    private var supaKey: String?

    private var rideId: String?
    private var rideStatus: String?
    private var puLat: Double?
    private var puLng: Double?
    private var doLat: Double?
    private var doLng: Double?

    private var lastGPSPatch: Date = .distantPast
    private var lastETAPatch: Date = .distantPast
    private let gpsFloor: TimeInterval = 1.5
    private let etaFloor: TimeInterval = 1.5
    private let nearbyMeters: Double = 152.0
    private var geofenceFired: Set<String> = []

    // MARK: - Plugin methods

    @objc func start(_ call: CAPPluginCall) {
        guard let did = call.getString("driverId"),
              let url = call.getString("supaUrl"),
              let key = call.getString("supaKey") else {
            call.reject("Missing driverId, supaUrl, or supaKey")
            return
        }
        driverId = did
        supaUrl = url
        supaKey = key

        DispatchQueue.main.async {
            self.locMgr.delegate = self
            self.locMgr.desiredAccuracy = kCLLocationAccuracyBest
            self.locMgr.allowsBackgroundLocationUpdates = true
            self.locMgr.pausesLocationUpdatesAutomatically = false
            self.locMgr.showsBackgroundLocationIndicator = true
            self.locMgr.distanceFilter = kCLDistanceFilterNone
            self.locMgr.requestAlwaysAuthorization()
            self.locMgr.startUpdatingLocation()
        }
        NSLog("[RydzLocation] started for driver %@", did)
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.locMgr.stopUpdatingLocation() }
        if let did = driverId {
            patch(table: "users", filter: "?id=eq.\(did)",
                  body: ["lat": NSNull(), "lng": NSNull()])
        }
        driverId = nil; rideId = nil; rideStatus = nil
        NSLog("[RydzLocation] stopped")
        call.resolve()
    }

    @objc func setRide(_ call: CAPPluginCall) {
        rideId     = call.getString("rideId")
        rideStatus = call.getString("status")
        puLat = call.getDouble("puLat")
        puLng = call.getDouble("puLng")
        doLat = call.getDouble("doLat")
        doLng = call.getDouble("doLng")
        call.resolve()
    }

    @objc func clearRide(_ call: CAPPluginCall) {
        rideId = nil; rideStatus = nil
        puLat = nil; puLng = nil; doLat = nil; doLng = nil
        call.resolve()
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager,
                                didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last, let did = driverId else { return }
        let lat = loc.coordinate.latitude
        let lng = loc.coordinate.longitude
        let now = Date()

        if now.timeIntervalSince(lastGPSPatch) >= gpsFloor {
            lastGPSPatch = now
            patch(table: "users", filter: "?id=eq.\(did)",
                  body: ["lat": lat, "lng": lng])
        }

        notifyListeners("locationUpdate", data: [
            "lat": lat, "lng": lng,
            "speed": loc.speed,
            "timestamp": now.timeIntervalSince1970 * 1000
        ])

        if now.timeIntervalSince(lastETAPatch) >= etaFloor {
            publishETA(fromLat: lat, fromLng: lng)
        }

        checkGeofence(lat: lat, lng: lng)
    }

    public func locationManager(_ manager: CLLocationManager,
                                didFailWithError error: Error) {
        NSLog("[RydzLocation] error: %@", error.localizedDescription)
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let s = manager.authorizationStatus
        NSLog("[RydzLocation] auth=%d", s.rawValue)
        if s == .denied || s == .restricted {
            notifyListeners("permissionDenied", data: [:])
        }
    }

    // MARK: - ETA

    private func publishETA(fromLat: Double, fromLng: Double) {
        guard let rid = rideId, let st = rideStatus else { return }
        if st == "completed" || st == "cancelled" || st == "canceled" { return }

        var tLat: Double?, tLng: Double?
        if st == "picked_up" || st == "in_progress" {
            tLat = doLat; tLng = doLng
        } else if st == "arrived" {
            lastETAPatch = Date()
            patch(table: "rides", filter: "?id=eq.\(rid)", body: [
                "driver_eta_secs": 0,
                "driver_eta_updated_at": ISO8601DateFormatter().string(from: Date())
            ])
            return
        } else {
            tLat = puLat; tLng = puLng
        }
        guard let toLat = tLat, let toLng = tLng,
              toLat != 0, toLng != 0 else { return }

        lastETAPatch = Date()

        let req = MKDirections.Request()
        req.source = MKMapItem(placemark: MKPlacemark(
            coordinate: CLLocationCoordinate2D(latitude: fromLat, longitude: fromLng)))
        req.destination = MKMapItem(placemark: MKPlacemark(
            coordinate: CLLocationCoordinate2D(latitude: toLat, longitude: toLng)))
        req.transportType = .automobile
        req.departureDate = Date()
        req.requestsAlternateRoutes = true
        if #available(iOS 16.0, *) {
            req.highwayPreference = .allow
            req.tollPreference = .allow
        }

        MKDirections(request: req).calculate { resp, err in
            guard let routes = resp?.routes, !routes.isEmpty else {
                NSLog("[RydzLocation] ETA failed: %@",
                      err?.localizedDescription ?? "no routes")
                return
            }
            let best = routes.min(by: {
                $0.expectedTravelTime < $1.expectedTravelTime
            })!
            let secs = Int(best.expectedTravelTime.rounded())
            NSLog("[RydzLocation] ETA %ds (%.1f min) status=%@ route=%@",
                  secs, Double(secs)/60.0, st, best.name)
            self.patch(table: "rides", filter: "?id=eq.\(rid)", body: [
                "driver_eta_secs": secs,
                "driver_eta_updated_at": ISO8601DateFormatter().string(from: Date())
            ])
        }
    }

    // MARK: - Geofence

    private func checkGeofence(lat: Double, lng: Double) {
        guard let rid = rideId, rideStatus == "accepted" else { return }
        guard let pLat = puLat, let pLng = puLng else { return }
        if geofenceFired.contains(rid) { return }

        let d = hav(lat, lng, pLat, pLng)
        if d <= nearbyMeters {
            geofenceFired.insert(rid)
            rideStatus = "arrived"
            NSLog("[RydzLocation] geofence hit ride=%@ dist=%.0fm", rid, d)
            patch(table: "rides", filter: "?id=eq.\(rid)",
                  body: ["status": "arrived"])
            notifyListeners("geofenceTriggered", data: ["rideId": rid])
        }
    }

    private func hav(_ lat1: Double, _ lng1: Double,
                     _ lat2: Double, _ lng2: Double) -> Double {
        let R = 6371000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLng = (lng2 - lng1) * .pi / 180
        let a = sin(dLat/2) * sin(dLat/2) +
                cos(lat1 * .pi/180) * cos(lat2 * .pi/180) *
                sin(dLng/2) * sin(dLng/2)
        return R * 2 * atan2(sqrt(a), sqrt(1-a))
    }

    // MARK: - HTTP

    private func patch(table: String, filter: String, body: [String: Any]) {
        guard let base = supaUrl, let key = supaKey,
              let url = URL(string: "\(base)/rest/v1/\(table)\(filter)") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        req.setValue(key, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req).resume()
    }
}
