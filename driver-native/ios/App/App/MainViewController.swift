import UIKit
import Capacitor

// MainViewController — subclass of CAPBridgeViewController that wires the
// app-local RydzMapKit plugin into the Capacitor JS bridge the moment the
// bridge exists. This guarantees `window.Capacitor.Plugins.RydzMapKit` is
// defined before the web layer's first tick, independent of any Objective-C
// CAP_PLUGIN macro or companion .m file (which was silently dropped from
// the Capacitor 8 SPM build and caused "_publishMapKitETA" to skip every
// publish, leaving driver_eta_secs stale).
//
// Main.storyboard's initial view controller's customClass is set to
// "MainViewController" / customModule="App" so this class runs instead of
// the stock CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RydzMapKit())
        bridge?.registerPluginInstance(RydzLocation())
    }
}
