import Foundation
import UIKit
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
        CAPPluginMethod(name: "clearRide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPendingRide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingRide", returnType: CAPPluginReturnPromise)
    ]

    private let locMgr = CLLocationManager()
    private var driverId: String?
    private var supaUrl: String?
    private var supaKey: String?

    // Active ride (accepted/en_route/arrived/picked_up)
    private var rideId: String?
    private var rideStatus: String?
    private var puLat: Double?
    private var puLng: Double?
    private var doLat: Double?
    private var doLng: Double?

    // Pending ride (requested, assigned but not accepted)
    private var pendingRideId: String?
    private var pendingPuLat: Double?
    private var pendingPuLng: Double?

    private var lastGPSPatch: Date = .distantPast
    private var lastETAPatch: Date = .distantPast
    private var lastPendingETAPatch: Date = .distantPast
    private let gpsFloor: TimeInterval = 1.5
    private let etaFloor: TimeInterval = 1.5
    private let pendingEtaFloor: TimeInterval = 1.5
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
        puLat = nil; puLng = nil; doLat = nil; doLng = nil
        pendingRideId = nil; pendingPuLat = nil; pendingPuLng = nil
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

    @objc func setPendingRide(_ call: CAPPluginCall) {
        pendingRideId = call.getString("rideId")
        pendingPuLat = call.getDouble("puLat")
        pendingPuLng = call.getDouble("puLng")
        call.resolve()
    }

    @objc func clearPendingRide(_ call: CAPPluginCall) {
        pendingRideId = nil; pendingPuLat = nil; pendingPuLng = nil
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

        if now.timeIntervalSince(lastPendingETAPatch) >= pendingEtaFloor {
            publishPendingETA(fromLat: lat, fromLng: lng)
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

    // MARK: - ETA (active ride)

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

        calcFastestRoute(fromLat: fromLat, fromLng: fromLng,
                         toLat: toLat, toLng: toLng) { secs in
            guard let secs = secs else { return }
            NSLog("[RydzLocation] ETA %ds (%.1f min) status=%@",
                  secs, Double(secs)/60.0, st)
            self.patch(table: "rides", filter: "?id=eq.\(rid)", body: [
                "driver_eta_secs": secs,
                "driver_eta_updated_at": ISO8601DateFormatter().string(from: Date())
            ])
        }
    }

    // MARK: - ETA (pending ride — chain-walked through active ride waypoints)

    private func publishPendingETA(fromLat: Double, fromLng: Double) {
        guard let prid = pendingRideId,
              let pLat = pendingPuLat,
              let pLng = pendingPuLng,
              pLat != 0, pLng != 0 else { return }

        lastPendingETAPatch = Date()

        var waypoints: [(Double, Double)] = []

        if let st = rideStatus, rideId != nil {
            if st == "accepted" || st == "en_route" {
                if let pla = puLat, let pln = puLng, pla != 0, pln != 0 {
                    waypoints.append((pla, pln))
                }
                if let dla = doLat, let dln = doLng, dla != 0, dln != 0 {
                    waypoints.append((dla, dln))
                }
            } else if st == "arrived" || st == "picked_up" {
                if let dla = doLat, let dln = doLng, dla != 0, dln != 0 {
                    waypoints.append((dla, dln))
                }
            }
        }

        waypoints.append((pLat, pLng))

        walkChain(fromLat: fromLat, fromLng: fromLng,
                  waypoints: waypoints, accumulated: 0) { totalSecs in
            guard let secs = totalSecs else { return }
            NSLog("[RydzLocation] pending ETA %ds (%.1f min) ride=%@",
                  secs, Double(secs)/60.0, prid)
            self.patch(table: "rides", filter: "?id=eq.\(prid)", body: [
                "driver_eta_secs": secs,
                "driver_eta_updated_at": ISO8601DateFormatter().string(from: Date())
            ])
        }
    }

    // Recursive chain walk: real MapKit ETA for each hop, summed.
    // If any hop returns nil, the whole chain returns nil (nothing patched that tick).
    private func walkChain(fromLat: Double, fromLng: Double,
                           waypoints: [(Double, Double)], accumulated: Int,
                           completion: @escaping (Int?) -> Void) {
        guard !waypoints.isEmpty else { completion(accumulated); return }

        let next = waypoints[0]
        let remaining = Array(waypoints.dropFirst())

        calcFastestRoute(fromLat: fromLat, fromLng: fromLng,
                         toLat: next.0, toLng: next.1) { secs in
            guard let hopSecs = secs else { completion(nil); return }
            self.walkChain(fromLat: next.0, fromLng: next.1,
                          waypoints: remaining, accumulated: accumulated + hopSecs,
                          completion: completion)
        }
    }

    // Real MapKit route calculation with background task extension so iOS
    // doesn't suspend the app before the network response arrives.
    private func calcFastestRoute(fromLat: Double, fromLng: Double,
                                  toLat: Double, toLng: Double,
                                  completion: @escaping (Int?) -> Void) {
        DispatchQueue.main.async {
            var bgTask: UIBackgroundTaskIdentifier = .invalid
            bgTask = UIApplication.shared.beginBackgroundTask(withName: "RydzETA") {
                // System is about to kill the task — clean up and skip this tick
                UIApplication.shared.endBackgroundTask(bgTask)
                bgTask = .invalid
                completion(nil)
            }

            let req = MKDirections.Request()
            req.source = MKMapItem(placemark: MKPlacemark(
                coordinate: CLLocationCoordinate2D(latitude: fromLat, longitude: fromLng)))
            req.destination = MKMapItem(placemark: MKPlacemark(
                coordinate: CLLocationCoordinate2D(latitude: toLat, longitude: toLng)))
            req.transportType = .automobile
            req.departureDate = Date()
            req.requestsAlternateRoutes = true
            if #available(iOS 16.0, *) {
                req.highwayPreference = .any
                req.tollPreference = .any
            }

            MKDirections(request: req).calculate { resp, err in
                defer {
                    DispatchQueue.main.async {
                        if bgTask != .invalid {
                            UIApplication.shared.endBackgroundTask(bgTask)
                            bgTask = .invalid
                        }
                    }
                }
                guard let routes = resp?.routes, !routes.isEmpty else {
                    NSLog("[RydzLocation] route failed: %@",
                          err?.localizedDescription ?? "no routes")
                    completion(nil)
                    return
                }
                let best = routes.min(by: {
                    $0.expectedTravelTime < $1.expectedTravelTime
                })!
                completion(Int(best.expectedTravelTime.rounded()))
            }
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
