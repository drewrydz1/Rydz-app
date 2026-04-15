import Foundation
import Capacitor
import MapKit
import CoreLocation

// RydzMapKit — Capacitor plugin bridging Apple MapKit routing to JS.
//
// Why this exists: MapKit's MKDirections.calculateETA is free, unlimited,
// and traffic-aware on iOS devices. It replaces our Google Directions /
// DistanceMatrix calls for every ETA computation in the app.
//
// Two methods:
//   calculateETA  — single source → single destination. Used by the driver
//                   app to publish its own ETA to the active ride's next
//                   waypoint (pickup or dropoff) on every GPS tick.
//   calculateETAs — single source → N destinations, fanned out in parallel.
//                   Used by the rider app for pre-accept dispatch when
//                   evaluating multiple online drivers simultaneously.
//
// Both methods set departureDate = now so MapKit incorporates live traffic.
@objc(RydzMapKit)
public class RydzMapKit: CAPPlugin {

    @objc func calculateETA(_ call: CAPPluginCall) {
        guard let fromLat = call.getDouble("fromLat"),
              let fromLng = call.getDouble("fromLng"),
              let toLat   = call.getDouble("toLat"),
              let toLng   = call.getDouble("toLng") else {
            call.reject("Missing coordinates")
            return
        }

        let src = CLLocationCoordinate2D(latitude: fromLat, longitude: fromLng)
        let dst = CLLocationCoordinate2D(latitude: toLat,   longitude: toLng)

        let req = MKDirections.Request()
        req.source = MKMapItem(placemark: MKPlacemark(coordinate: src))
        req.destination = MKMapItem(placemark: MKPlacemark(coordinate: dst))
        req.transportType = .automobile
        req.departureDate = Date()  // enables live traffic awareness

        MKDirections(request: req).calculateETA { resp, err in
            if let resp = resp {
                call.resolve([
                    "seconds":  resp.expectedTravelTime,
                    "distance": resp.distance
                ])
            } else {
                call.reject(err?.localizedDescription ?? "No route found")
            }
        }
    }

    @objc func calculateETAs(_ call: CAPPluginCall) {
        guard let fromLat = call.getDouble("fromLat"),
              let fromLng = call.getDouble("fromLng"),
              let destinations = call.getArray("destinations") as? [[String: Any]] else {
            call.reject("Missing parameters")
            return
        }

        let src = CLLocationCoordinate2D(latitude: fromLat, longitude: fromLng)
        let group = DispatchGroup()
        let lock  = NSLock()
        var results: [[String: Any]] = []

        for dest in destinations {
            guard let id   = dest["id"]  as? String,
                  let dLat = dest["lat"] as? Double,
                  let dLng = dest["lng"] as? Double else { continue }

            group.enter()
            let dstCoord = CLLocationCoordinate2D(latitude: dLat, longitude: dLng)
            let req = MKDirections.Request()
            req.source = MKMapItem(placemark: MKPlacemark(coordinate: src))
            req.destination = MKMapItem(placemark: MKPlacemark(coordinate: dstCoord))
            req.transportType = .automobile
            req.departureDate = Date()

            MKDirections(request: req).calculateETA { resp, err in
                lock.lock()
                if let resp = resp {
                    results.append([
                        "id":       id,
                        "seconds":  resp.expectedTravelTime,
                        "distance": resp.distance
                    ])
                } else {
                    results.append([
                        "id":    id,
                        "error": err?.localizedDescription ?? "unknown"
                    ])
                }
                lock.unlock()
                group.leave()
            }
        }

        group.notify(queue: .main) {
            call.resolve(["results": results])
        }
    }
}
