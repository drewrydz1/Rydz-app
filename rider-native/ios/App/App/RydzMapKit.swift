import Foundation
import Capacitor
import MapKit
import CoreLocation

// RydzMapKit — Capacitor plugin bridging Apple MapKit to JS.
//
// Why this exists: MapKit's MKDirections, MKLocalSearch, and CLGeocoder
// are free, unlimited, and high-quality on iOS devices. They replace
// our Google Directions / DistanceMatrix / Places / Geocoding calls.
//
// Methods:
//   calculateETA       — 1→1 driving ETA with live traffic.
//   calculateETAs      — 1→N driving ETAs fanned out in parallel.
//   searchPlaces       — natural-language place search (replaces Google
//                        Places textSearch / nearbySearch).
//   searchAutocomplete — live autocomplete suggestions as the user types
//                        (replaces Google Places AutocompleteService).
//   geocode            — address string → lat/lng (replaces Google Geocoder).
@objc(RydzMapKit)
public class RydzMapKit: CAPPlugin {

    // Persistent completer for autocomplete — holds state between queries
    // so MapKit's incremental results land back on the JS side.
    private var completer: MKLocalSearchCompleter?
    private var completerDelegate: CompleterDelegate?

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

    // MARK: - Places search (replaces Google Places textSearch/nearbySearch)

    /// Natural-language place search biased to a region.
    /// Input: query, centerLat, centerLng, radiusMeters, maxResults
    /// Output: results[] with {id, name, address, lat, lng}
    @objc func searchPlaces(_ call: CAPPluginCall) {
        guard let query = call.getString("query") else {
            call.reject("Missing query")
            return
        }
        let centerLat = call.getDouble("centerLat") ?? 26.1334
        let centerLng = call.getDouble("centerLng") ?? -81.7935
        let radius    = call.getDouble("radiusMeters") ?? 15000
        let maxResults = call.getInt("maxResults") ?? 20

        let req = MKLocalSearch.Request()
        req.naturalLanguageQuery = query
        req.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLng),
            latitudinalMeters: radius * 2,
            longitudinalMeters: radius * 2
        )

        MKLocalSearch(request: req).start { response, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            guard let items = response?.mapItems else {
                call.resolve(["results": []])
                return
            }
            var out: [[String: Any]] = []
            for item in items.prefix(maxResults) {
                let coord = item.placemark.coordinate
                var addrParts: [String] = []
                if let street = item.placemark.thoroughfare { addrParts.append(street) }
                if let sub = item.placemark.subThoroughfare, !addrParts.isEmpty {
                    addrParts[0] = "\(sub) \(addrParts[0])"
                } else if let sub = item.placemark.subThoroughfare {
                    addrParts.append(sub)
                }
                if let city = item.placemark.locality { addrParts.append(city) }
                if let state = item.placemark.administrativeArea { addrParts.append(state) }
                let address = addrParts.joined(separator: ", ")
                out.append([
                    "id":      "\(coord.latitude),\(coord.longitude)",
                    "name":    item.name ?? address,
                    "address": address.isEmpty ? "Naples, FL" : address,
                    "lat":     coord.latitude,
                    "lng":     coord.longitude
                ])
            }
            call.resolve(["results": out])
        }
    }

    // MARK: - Autocomplete (replaces Google AutocompleteService)

    /// Incremental autocomplete as the user types.
    /// Input: query, centerLat, centerLng, radiusMeters
    /// Output: results[] with {title, subtitle}
    /// Note: MKLocalSearchCompleter only returns {title, subtitle}; to get
    /// coordinates the JS layer should call searchPlaces(title + subtitle).
    @objc func searchAutocomplete(_ call: CAPPluginCall) {
        guard let query = call.getString("query") else {
            call.reject("Missing query")
            return
        }
        let centerLat = call.getDouble("centerLat") ?? 26.1334
        let centerLng = call.getDouble("centerLng") ?? -81.7935
        let radius    = call.getDouble("radiusMeters") ?? 15000

        DispatchQueue.main.async {
            if self.completer == nil {
                self.completer = MKLocalSearchCompleter()
                self.completerDelegate = CompleterDelegate()
                self.completer?.delegate = self.completerDelegate
                self.completer?.resultTypes = [.address, .pointOfInterest]
            }
            self.completer?.region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLng),
                latitudinalMeters: radius * 2,
                longitudinalMeters: radius * 2
            )
            self.completerDelegate?.pendingCall = call
            self.completer?.queryFragment = query
        }
    }

    // MARK: - Geocoder (replaces Google Geocoder)

    /// Forward-geocode an address string to a coordinate.
    /// Input: address
    /// Output: {lat, lng, formattedAddress}
    @objc func geocode(_ call: CAPPluginCall) {
        guard let address = call.getString("address") else {
            call.reject("Missing address")
            return
        }
        CLGeocoder().geocodeAddressString(address) { placemarks, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            guard let pm = placemarks?.first, let loc = pm.location else {
                call.reject("No results")
                return
            }
            var addrParts: [String] = []
            if let street = pm.thoroughfare {
                if let sub = pm.subThoroughfare {
                    addrParts.append("\(sub) \(street)")
                } else {
                    addrParts.append(street)
                }
            }
            if let city = pm.locality { addrParts.append(city) }
            if let state = pm.administrativeArea { addrParts.append(state) }
            call.resolve([
                "lat":              loc.coordinate.latitude,
                "lng":              loc.coordinate.longitude,
                "formattedAddress": addrParts.joined(separator: ", ")
            ])
        }
    }
}

// MARK: - Completer delegate

/// Bridges MKLocalSearchCompleter's delegate callbacks back to the
/// in-flight CAPPluginCall. Because the completer is async and fires
/// completerDidUpdateResults whenever MapKit has new matches, we resolve
/// the pending call with the latest batch.
private class CompleterDelegate: NSObject, MKLocalSearchCompleterDelegate {
    var pendingCall: CAPPluginCall?

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        guard let call = pendingCall else { return }
        var out: [[String: Any]] = []
        for r in completer.results.prefix(10) {
            out.append([
                "title":    r.title,
                "subtitle": r.subtitle
            ])
        }
        call.resolve(["results": out])
        pendingCall = nil
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        pendingCall?.reject(error.localizedDescription)
        pendingCall = nil
    }
}
