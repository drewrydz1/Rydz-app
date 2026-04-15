import Foundation
import Capacitor
import MapKit
import CoreLocation

// RydzMapKit — Capacitor plugin bridging Apple MapKit to JS for the
// driver app. The driver iPhone calls `calculateETA` every ~1.5s via
// location.js::_publishMapKitETA, then writes the result into the ride
// row on Supabase. The rider (on any platform) then just reads that
// column out of the rides table — no MapKit needed on the rider side.
//
// Why this plugin is registered from MainViewController.capacitorDidLoad()
// rather than via a CAP_PLUGIN Objective-C macro:
//   Hand-added .m companion files weren't being compiled into the Capacitor
//   8 SPM build, so the CAP_PLUGIN macro's constructor never fired and
//   window.Capacitor.Plugins.RydzMapKit was undefined at runtime. We now
//   conform to CAPBridgedPlugin directly in Swift and register an instance
//   from the subclassed view controller, which bypasses the macro path
//   entirely and makes the plugin available as soon as the bridge exists.
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
        req.requestsAlternateRoutes = false  // single fastest route

        // We intentionally use calculate() instead of calculateETA() here.
        // calculateETA() is Apple's fast-path ballpark — it uses road-speed
        // averages plus a light historical traffic model and routinely
        // disagrees with the Apple Maps app by 3-8 minutes during real
        // traffic. calculate() returns full MKRoute objects whose
        // expectedTravelTime is the same traffic-adjusted number Apple Maps
        // itself displays. Marginally slower (~100-300ms) but well within
        // our 1500ms driver publish throttle, and still free unlimited.
        //
        // If multiple routes come back we take the minimum — Apple Maps
        // always shows the fastest, and dropping the others matches their
        // UI expectation.
        MKDirections(request: req).calculate { resp, err in
            if let routes = resp?.routes, !routes.isEmpty {
                let best = routes.min(by: { $0.expectedTravelTime < $1.expectedTravelTime })!
                call.resolve([
                    "seconds":  best.expectedTravelTime,
                    "distance": best.distance
                ])
            } else {
                call.reject(err?.localizedDescription ?? "No route found")
            }
        }
    }
}
