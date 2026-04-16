import Foundation
import Capacitor
import MapKit
import CoreLocation

// RydzMapKit — Capacitor plugin bridging Apple MapKit to JS for the
// rider app. The rider iPhone calls `calculateETA` on every wait-screen
// tick with (driverLat, driverLng) → (destLat, destLng) to compute a
// fresh, traffic-accurate ETA LOCALLY. No Google calls, no round-trip
// to the driver. Apple MapKit is free and unlimited on iOS, so the
// rider is now fully self-sufficient for wait times — it doesn't
// matter if the driver's JS layer is backgrounded/throttled and not
// publishing driver_eta_secs, because the rider recomputes from the
// driver's fresh users.lat/lng (which the native background location
// bridge keeps updated on the server side regardless of JS state).
//
// This is a verbatim copy of driver-native/ios/App/App/RydzMapKit.swift
// — same plugin, registered in both apps via MainViewController's
// capacitorDidLoad().
@objc(RydzMapKit)
public class RydzMapKit: CAPPlugin, CAPBridgedPlugin {

    // MARK: - CAPBridgedPlugin conformance
    public let identifier = "RydzMapKitPlugin"
    public let jsName = "RydzMapKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "calculateETA", returnType: CAPPluginReturnPromise)
    ]

    // MARK: - ETA

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
        req.departureDate = Date()           // required for traffic weighting
        req.requestsAlternateRoutes = true   // let MapKit compute alternates
        if #available(iOS 16.0, *) {
            req.highwayPreference = .allow
            req.tollPreference = .allow
        }

        // calculate() returns full MKRoute objects with traffic-adjusted
        // expectedTravelTime — same number Apple Maps displays. We pick
        // the fastest across all alternates to mirror Apple Maps'
        // default "fastest route" behavior.
        MKDirections(request: req).calculate { resp, err in
            if let routes = resp?.routes, !routes.isEmpty {
                NSLog("[RydzMapKit][rider] calculate from=(%.5f,%.5f) to=(%.5f,%.5f) returned %d routes",
                      fromLat, fromLng, toLat, toLng, routes.count)
                for (i, r) in routes.enumerated() {
                    NSLog("[RydzMapKit][rider]   route[%d]: %.0fs (%.1f min), %.0fm, name=%@",
                          i, r.expectedTravelTime, r.expectedTravelTime / 60.0,
                          r.distance, r.name)
                }
                let best = routes.min(by: { $0.expectedTravelTime < $1.expectedTravelTime })!
                NSLog("[RydzMapKit][rider]   -> picked %.0fs (%.1f min), name=%@",
                      best.expectedTravelTime, best.expectedTravelTime / 60.0, best.name)
                call.resolve([
                    "seconds":  best.expectedTravelTime,
                    "distance": best.distance
                ])
            } else {
                NSLog("[RydzMapKit][rider] calculate FAILED: %@",
                      err?.localizedDescription ?? "no routes, no error")
                call.reject(err?.localizedDescription ?? "No route found")
            }
        }
    }
}
