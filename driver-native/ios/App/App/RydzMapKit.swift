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
}
