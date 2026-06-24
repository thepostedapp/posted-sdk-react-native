export { createPostedNativeIntentHandler } from "./nativeIntent";

export type {
  PostedNativeIntentArgs,
  PostedNativeIntentHandler,
  PostedNativeIntentOptions,
  PostedNativeIntentResolveConfig,
  PostedNativeIntentResolvedValue,
} from "./nativeIntent";

// @deprecated Use createPostedNativeIntentHandler instead. Will be removed in a future major version.
export { createPostedNativeIntentHandler as createDetourNativeIntentHandler } from "./nativeIntent";

export type {
  // @deprecated Use PostedNativeIntentArgs instead. Will be removed in a future major version.
  PostedNativeIntentArgs as DetourNativeIntentArgs,
  // @deprecated Use PostedNativeIntentHandler instead. Will be removed in a future major version.
  PostedNativeIntentHandler as DetourNativeIntentHandler,
  // @deprecated Use PostedNativeIntentOptions instead. Will be removed in a future major version.
  PostedNativeIntentOptions as DetourNativeIntentOptions,
  // @deprecated Use PostedNativeIntentResolveConfig instead. Will be removed in a future major version.
  PostedNativeIntentResolveConfig as DetourNativeIntentResolveConfig,
  // @deprecated Use PostedNativeIntentResolvedValue instead. Will be removed in a future major version.
  PostedNativeIntentResolvedValue as DetourNativeIntentResolvedValue,
} from "./nativeIntent";
