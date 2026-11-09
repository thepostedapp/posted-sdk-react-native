#import <React/RCTBridgeModule.h>

@interface PostedSdk : NSObject <RCTBridgeModule>
@end

@implementation PostedSdk

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  return @{@"installSource" : [self installSource]};
}

// Development, ad hoc and enterprise builds embed a provisioning profile;
// TestFlight builds carry a sandbox receipt.
- (NSString *)installSource
{
#if TARGET_OS_SIMULATOR
  return @"development";
#else
  NSBundle *bundle = [NSBundle mainBundle];
  if ([bundle pathForResource:@"embedded" ofType:@"mobileprovision"] ||
      [bundle.appStoreReceiptURL.lastPathComponent isEqualToString:@"sandboxReceipt"]) {
    return @"development";
  }
  return @"store";
#endif
}

@end
