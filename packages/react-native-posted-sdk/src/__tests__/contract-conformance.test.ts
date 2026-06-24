/**
 * Wire-format conformance suite — POS-40
 *
 * Validates that every fetch call emitted by the RN SDK matches the
 * detour-backend-contract.yaml schema for URL, method, headers, and body.
 *
 * Mechanism: mock global.fetch, capture calls, validate body with ajv against
 * schemas extracted from the vendored OpenAPI contract.
 *
 * Pinned contract: src/__tests__/__fixtures__/detour-backend-contract.yaml
 * Canonical source: posted-sdk-admin/contract/detour-backend-contract.yaml
 */

import fs from "fs";
import path from "path";

// ---- Module mocks (hoisted by jest before imports) ----

jest.mock("expo-application", () => ({
  __esModule: true,
  getInstallReferrerAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("expo-clipboard", () => ({
  __esModule: true,
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    nativeAppVersion: "1.0.0",
    getWebViewUserAgentAsync: jest.fn().mockResolvedValue("TestAgent/1.0"),
  },
}));

jest.mock("expo-localization", () => ({
  __esModule: true,
  getLocales: jest.fn().mockReturnValue([{ languageTag: "en-US" }]),
  getCalendars: jest.fn().mockReturnValue([{ timeZone: "America/New_York" }]),
}));

jest.mock("expo-device", () => ({
  modelName: "iPhone 14",
  manufacturer: "Apple",
  osVersion: "17.0.0",
}));

// ---- SDK imports (after mocks are registered) ----

import { getDeferredLink } from "../links/api/getDeferredLink";
import { resolveShortLink } from "../links/api/resolveShortLink";
import { sendUniversalLinkClick } from "../links/api/sendUniversalLinkClick";
import { sendEvent } from "../analytics/api/events";
import { sendRetentionEvent } from "../analytics/api/retention";
import { SDK_HEADER_VALUE } from "../version";
import { PostedEventNames } from "../analytics/types";

// ---- Contract + AJV setup ----

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv = require("ajv");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require("js-yaml");

const contractPath = path.join(__dirname, "__fixtures__", "detour-backend-contract.yaml");
const contract = yaml.load(fs.readFileSync(contractPath, "utf-8"));

// unknownFormats allows OpenAPI extension formats (int64, int32) to pass through unvalidated
const ajv = new Ajv({ allErrors: true, unknownFormats: ["int64", "int32"] });
// Register the full OpenAPI document as "root"; all fragment $refs resolve within it.
ajv.addSchema(contract, "root");

function makeValidator(schemaFragment: string) {
  return ajv.compile({ $ref: `root${schemaFragment}` });
}

const validateDeterministicMatch = makeValidator("#/components/schemas/DeterministicMatch");
const validateProbabilisticFingerprint = makeValidator(
  "#/components/schemas/ProbabilisticFingerprint",
);
const validateResolveShort = makeValidator("#/components/schemas/ResolveShortRequest");
const validateUniversalLinkClick = makeValidator(
  "#/components/schemas/UniversalLinkClickRequest",
);
const validateAnalyticsEvent = makeValidator("#/components/schemas/AnalyticsEventRequest");
const validateRetentionEvent = makeValidator("#/components/schemas/RetentionEventRequest");

// oneOf matcher covering both match-link shapes
const validateMatchLinkBody = ajv.compile({
  oneOf: [
    { $ref: "root#/components/schemas/DeterministicMatch" },
    { $ref: "root#/components/schemas/ProbabilisticFingerprint" },
  ],
});

// ---- Helpers ----

const API_KEY = "test-api-key-123";
const APP_ID = "test-app-id-456";
const DEVICE_ID = "8f2b1c9e-7d3a-4e21-9f10-2c5b6a1d4e88";

type CapturedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

function mockFetch(responseBody: object = {}, status = 200): CapturedCall[] {
  const calls: CapturedCall[] = [];
  global.fetch = jest.fn().mockImplementation(async (url: string, opts: RequestInit = {}) => {
    calls.push({
      url,
      method: opts.method ?? "GET",
      headers: (opts.headers ?? {}) as Record<string, string>,
      body: opts.body ? JSON.parse(opts.body as string) : undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(responseBody),
    };
  }) as jest.Mock;
  return calls;
}

function assertCommonHeaders(headers: Record<string, string>) {
  expect(headers["Authorization"]).toBe(`Bearer ${API_KEY}`);
  expect(headers["X-App-ID"]).toBe(APP_ID);
  expect(headers["X-SDK"]).toBe(SDK_HEADER_VALUE);
  expect(headers["X-SDK"]).toMatch(/^react-native\//);
}

function assertSchemaValid(
  validator: ReturnType<typeof ajv.compile>,
  data: unknown,
  label: string,
) {
  const valid = validator(data);
  if (!valid) {
    throw new Error(
      `${label} schema violation:\n${JSON.stringify(validator.errors, null, 2)}`,
    );
  }
}

// ---- Test suite ----

describe("RN SDK → backend contract conformance", () => {
  let appMock: { getInstallReferrerAsync: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appMock = require("expo-application");
  });

  // -----------------------------------------------------------------------
  // 1. match-link — deterministic branch ({clickId})
  // -----------------------------------------------------------------------
  describe("match-link (deterministic clickId)", () => {
    it("sends {clickId} body and correct headers; body conforms to DeterministicMatch schema", async () => {
      appMock.getInstallReferrerAsync.mockResolvedValue("click_id=abc123-click-789");
      const calls = mockFetch({ link: null });

      await getDeferredLink({ apiKey: API_KEY, appID: APP_ID, shouldUseClipboard: false });

      expect(calls).toHaveLength(1);
      const { url, method, headers, body } = calls[0]!;

      expect(url).toBe("https://godetour.dev/api/link/match-link");
      expect(method).toBe("POST");
      assertCommonHeaders(headers);

      // Body must satisfy DeterministicMatch (only clickId, no extra props)
      expect(body).toEqual({ clickId: "abc123-click-789" });
      assertSchemaValid(validateDeterministicMatch, body, "DeterministicMatch");
      // And must satisfy the oneOf union used in the contract path
      assertSchemaValid(validateMatchLinkBody, body, "match-link oneOf");
    });
  });

  // -----------------------------------------------------------------------
  // 2. match-link — probabilistic fingerprint branch
  // -----------------------------------------------------------------------
  describe("match-link (probabilistic fingerprint)", () => {
    it("sends device fingerprint body; body conforms to ProbabilisticFingerprint schema", async () => {
      appMock.getInstallReferrerAsync.mockResolvedValue(null);
      const calls = mockFetch({ link: null });

      await getDeferredLink({ apiKey: API_KEY, appID: APP_ID, shouldUseClipboard: false });

      expect(calls).toHaveLength(1);
      const { url, method, headers, body } = calls[0]!;

      expect(url).toBe("https://godetour.dev/api/link/match-link");
      expect(method).toBe("POST");
      assertCommonHeaders(headers);

      const fp = body as Record<string, unknown>;

      // Timestamp must be epoch-ms (integer)
      expect(typeof fp.timestamp).toBe("number");
      expect(Number.isInteger(fp.timestamp)).toBe(true);
      expect(fp.timestamp as number).toBeGreaterThan(0);

      // Platform must be ios or android
      expect(["ios", "android"]).toContain(fp.platform);

      // locale must be array of {languageTag}
      expect(Array.isArray(fp.locale)).toBe(true);

      assertSchemaValid(validateProbabilisticFingerprint, body, "ProbabilisticFingerprint");
      assertSchemaValid(validateMatchLinkBody, body, "match-link oneOf");
    });
  });

  // -----------------------------------------------------------------------
  // 3. resolve-short — {url}
  // -----------------------------------------------------------------------
  describe("resolve-short", () => {
    it("sends {url} body and correct headers; body conforms to ResolveShortRequest schema", async () => {
      const calls = mockFetch({ link: "https://godetour.dev/app/promo" });
      const shortUrl = "https://godetour.dev/x9Az";

      await resolveShortLink({ apiKey: API_KEY, appID: APP_ID, url: shortUrl });

      expect(calls).toHaveLength(1);
      const { url, method, headers, body } = calls[0]!;

      expect(url).toBe("https://godetour.dev/api/link/resolve-short");
      expect(method).toBe("POST");
      assertCommonHeaders(headers);

      expect(body).toEqual({ url: shortUrl });
      assertSchemaValid(validateResolveShort, body, "ResolveShortRequest");
    });
  });

  // -----------------------------------------------------------------------
  // 4a. universal-link-click — url with no query params (params omitted)
  // -----------------------------------------------------------------------
  describe("universal-link-click (no query params)", () => {
    it("omits params when URL has no query string; body conforms to UniversalLinkClickRequest schema", async () => {
      const calls = mockFetch({ allowed: true, clickId: "clk_001" });
      const clickUrl = "https://godetour.dev/u/launch";

      await sendUniversalLinkClick({ apiKey: API_KEY, appID: APP_ID, url: clickUrl });

      expect(calls).toHaveLength(1);
      const { url, method, headers, body } = calls[0]!;

      expect(url).toBe("https://godetour.dev/api/link/universal-link-click");
      expect(method).toBe("POST");
      assertCommonHeaders(headers);

      const b = body as Record<string, unknown>;
      expect(b.url).toBe(clickUrl);
      expect(["ios", "android", "unknown"]).toContain(b.platform);

      // params must be absent when URL has no query string
      expect(Object.prototype.hasOwnProperty.call(b, "params")).toBe(false);

      // timestamp must be epoch-ms integer
      expect(typeof b.timestamp).toBe("number");
      expect(Number.isInteger(b.timestamp)).toBe(true);
      expect(b.timestamp as number).toBeGreaterThan(0);

      assertSchemaValid(validateUniversalLinkClick, body, "UniversalLinkClickRequest");
    });
  });

  // -----------------------------------------------------------------------
  // 4b. universal-link-click — url with query params (params included)
  // -----------------------------------------------------------------------
  describe("universal-link-click (with query params)", () => {
    it("includes params when URL has a query string; body conforms to UniversalLinkClickRequest schema", async () => {
      const calls = mockFetch({ allowed: true, clickId: "clk_002" });
      const clickUrl = "https://godetour.dev/u/launch?campaign=spring&variant=b";

      await sendUniversalLinkClick({ apiKey: API_KEY, appID: APP_ID, url: clickUrl });

      expect(calls).toHaveLength(1);
      const { body } = calls[0]!;
      const b = body as Record<string, unknown>;

      // params must be present and contain the URL query parameters
      expect(b.params).toEqual({ campaign: "spring", variant: "b" });

      assertSchemaValid(validateUniversalLinkClick, body, "UniversalLinkClickRequest");
    });
  });

  // -----------------------------------------------------------------------
  // 5. analytics/event — ISO-8601 timestamp; optional data
  // -----------------------------------------------------------------------
  describe("analytics/event", () => {
    it("sends event body with ISO-8601 timestamp; body conforms to AnalyticsEventRequest schema", async () => {
      const calls = mockFetch({}, 200);

      await sendEvent({
        apiKey: API_KEY,
        appID: APP_ID,
        deviceId: DEVICE_ID,
        event: {
          eventName: PostedEventNames.Purchase,
          data: { order_id: "ord_1001", value: 29.99 },
        },
      });

      expect(calls).toHaveLength(1);
      const { url, method, headers, body } = calls[0]!;

      expect(url).toBe("https://godetour.dev/api/analytics/event");
      expect(method).toBe("POST");
      assertCommonHeaders(headers);

      const b = body as Record<string, unknown>;
      expect(b.event_name).toBe("purchase");
      expect(b.device_id).toBe(DEVICE_ID);

      // Timestamp must be ISO-8601 UTC with ms precision (not epoch-ms)
      expect(typeof b.timestamp).toBe("string");
      expect(b.timestamp as string).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // data must be present when supplied
      expect(b.data).toEqual({ order_id: "ord_1001", value: 29.99 });

      assertSchemaValid(validateAnalyticsEvent, body, "AnalyticsEventRequest");
    });

    it("sends event without data field when data is undefined", async () => {
      const calls = mockFetch({}, 200);

      await sendEvent({
        apiKey: API_KEY,
        appID: APP_ID,
        deviceId: DEVICE_ID,
        event: { eventName: PostedEventNames.Login, data: undefined },
      });

      expect(calls).toHaveLength(1);
      const { body } = calls[0]!;
      const b = body as Record<string, unknown>;

      expect(b.event_name).toBe(PostedEventNames.Login);
      // data absent when undefined (JSON.stringify drops undefined values)
      expect(Object.prototype.hasOwnProperty.call(b, "data")).toBe(false);

      assertSchemaValid(validateAnalyticsEvent, body, "AnalyticsEventRequest");
    });
  });

  // -----------------------------------------------------------------------
  // 6. analytics/retention — no data field ever
  // -----------------------------------------------------------------------
  describe("analytics/retention", () => {
    it("sends retention event with ISO-8601 timestamp and no data field; body conforms to RetentionEventRequest schema", async () => {
      const calls = mockFetch({}, 200);

      await sendRetentionEvent({
        apiKey: API_KEY,
        appID: APP_ID,
        deviceId: DEVICE_ID,
        eventName: "app_open",
      });

      expect(calls).toHaveLength(1);
      const { url, method, headers, body } = calls[0]!;

      expect(url).toBe("https://godetour.dev/api/analytics/retention");
      expect(method).toBe("POST");
      assertCommonHeaders(headers);

      const b = body as Record<string, unknown>;
      expect(b.event_name).toBe("app_open");
      expect(b.device_id).toBe(DEVICE_ID);

      // Timestamp must be ISO-8601 UTC with ms precision
      expect(typeof b.timestamp).toBe("string");
      expect(b.timestamp as string).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // data must never be present on retention events
      expect(Object.prototype.hasOwnProperty.call(b, "data")).toBe(false);

      assertSchemaValid(validateRetentionEvent, body, "RetentionEventRequest");
    });
  });
});
