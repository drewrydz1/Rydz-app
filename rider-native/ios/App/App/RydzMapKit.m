#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Capacitor plugin registration for RydzMapKit.swift.
// This file is required so the Capacitor JS bridge can find and call
// the Swift plugin methods by name.
CAP_PLUGIN(RydzMapKit, "RydzMapKit",
    CAP_PLUGIN_METHOD(calculateETA,  CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(calculateETAs, CAPPluginReturnPromise);
)
