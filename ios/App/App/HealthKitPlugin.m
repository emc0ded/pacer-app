#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Register the plugin so Capacitor can find it by name "HealthKit"
CAP_PLUGIN(HealthKitPlugin, "HealthKit",
    CAP_PLUGIN_METHOD(isAvailable,           CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestAuthorization,  CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(saveWorkout,           CAPPluginReturnPromise);
)
