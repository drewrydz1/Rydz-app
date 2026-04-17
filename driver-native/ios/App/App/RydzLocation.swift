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
        CAPPluginMethod(name: "clearRide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPendingRides", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingRides", returnType: CAPPluginReturnPromise)
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

    // Pending rides queue (requested, assigned but not accepted)
    private struct PendingRide {
        let id: String
        let puLat: Double
        let puLng: Double
        let doLat: Double
        let doLng: Double
    }
    private var pendingRides: [PendingRide] = []

    private var lastGPSPatch: Date = .distantPast
    private var lastETAPatch: Date = .distantPast
    private var lastPendingETAPatch: Date = .distantPast
    private let gpsFloor: TimeInterval = 1.5
    private let etaFloor: TimeInterval = 1.5
    private let pendingEtaFloor: TimeInterval = 5.0
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
        pendingRides = []
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

    @objc func setPendingRides(_ call: CAPPluginCall) {
        guard let arr = call.getArray("rides") as? [[String: Any]] else {
            pendingRides = []
            call.resolve()
            return
        }
        pendingRides = arr.compactMap { dict in
            guard let id = dict["rideId"] as? String,
                  let pLat = dict["puLat"] as? Double,
                  let pLng = dict["puLng"] as? Double else { return nil }
            let dLat = dict["doLat"] as? Double ?? 0
            let dLng = dict["doLng"] as? Double ?? 0
            return PendingRide(id: id, puLat: pLat, puLng: pLng, doLat: dLat, doLng: dLng)
        }
        NSLog("[RydzLocation] setPendingRides count=%d", pendingRides.count)
        call.resolve()
    }

    @objc func clearPendingRides(_ call: CAPPluginCall) {
        pendingRides = []
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
            publishPendingETAs(fromLat: lat, fromLng: lng)
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
        let capturedStatus = st

        calcFastestRoute(fromLat: fromLat, fromLng: fromLng,
                         toLat: toLat, toLng: toLng) { secs in
            guard let secs = secs else { return }
            // If the ride status changed while MapKit was calculating, discard
            // the result — the new status will publish its own ETA on the next tick.
            guard self.rideStatus == capturedStatus else { return }
            NSLog("[RydzLocation] ETA %ds (%.1f min) status=%@",
                  secs, Double(secs)/60.0, capturedStatus)
            self.patch(table: "rides", filter: "?id=eq.\(rid)", body: [
                "driver_eta_secs": secs,
                "driver_eta_updated_at": ISO8601DateFormatter().string(from: Date())
            ])
        }
    }

    // MARK: - ETA (pending rides — chain-walked through active + all queued rides)
    //
    // Walks: driver pos → active ride waypoints → pending ride 1 pickup →
    //        pending ride 1 dropoff → pending ride 2 pickup → ...
    //
    // At each pending ride's PICKUP waypoint, publishes the accumulated
    // time as that ride's driver_eta_secs. Each rider in the chain sees
    // their own ETA, decreasing as the driver progresses.

    private func publishPendingETAs(fromLat: Double, fromLng: Double) {
        guard !pendingRides.isEmpty else { return }
        lastPendingETAPatch = Date()

        // Build waypoint chain with markers for where each ride's pickup falls
        var chain: [(lat: Double, lng: Double)] = []
        var pickupMarkers: [(id: String, waypointIdx: Int)] = []

        // Active ride remaining waypoints
        if let st = rideStatus, rideId != nil {
            if st == "accepted" || st == "en_route" {
                if let pla = puLat, let pln = puLng, pla != 0, pln != 0 {
                    chain.append((pla, pln))
                }
                if let dla = doLat, let dln = doLng, dla != 0, dln != 0 {
                    chain.append((dla, dln))
                }
            } else if st == "arrived" || st == "picked_up" {
                if let dla = doLat, let dln = doLng, dla != 0, dln != 0 {
                    chain.append((dla, dln))
                }
            }
        }

        // Each pending ride: mark pickup index, add pickup + dropoff to chain
        for ride in pendingRides {
            pickupMarkers.append((ride.id, chain.count))
            chain.append((ride.puLat, ride.puLng))
            if ride.doLat != 0 && ride.doLng != 0 {
                chain.append((ride.doLat, ride.doLng))
            }
        }

        guard !chain.isEmpty else { return }

        // Walk each leg via MapKit, publishing at each ride's pickup waypoint
        walkAndPublish(fromLat: fromLat, fromLng: fromLng,
                       chain: chain, chainIndex: 0, accumulated: 0,
                       pickups: pickupMarkers)
    }

    private func walkAndPublish(fromLat: Double, fromLng: Double,
                                chain: [(lat: Double, lng: Double)],
                                chainIndex: Int, accumulated: Int,
                                pickups: [(id: String, waypointIdx: Int)]) {
        // Publish for any ride whose pickup is at this chain position
        for (rideId, idx) in pickups where idx == chainIndex {
            NSLog("[RydzLocation] chain ETA ride=%@ %ds (%.1f min)",
                  rideId, accumulated, Double(accumulated) / 60.0)
            patch(table: "rides", filter: "?id=eq.\(rideId)", body: [
                "driver_eta_secs": accumulated,
                "driver_eta_updated_at": ISO8601DateFormatter().string(from: Date())
            ])
        }

        guard chainIndex < chain.count else { return }

        let next = chain[chainIndex]
        calcFastestRoute(fromLat: fromLat, fromLng: fromLng,
                         toLat: next.lat, toLng: next.lng) { secs in
            guard let s = secs else { return }
            self.walkAndPublish(fromLat: next.lat, fromLng: next.lng,
                               chain: chain, chainIndex: chainIndex + 1,
                               accumulated: accumulated + s,
                               pickups: pickups)
        }
    }

    // MARK: - Shared MapKit fastest-route calculation

    private func calcFastestRoute(fromLat: Double, fromLng: Double,
                                  toLat: Double, toLng: Double,
                                  completion: @escaping (Int?) -> Void) {
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
