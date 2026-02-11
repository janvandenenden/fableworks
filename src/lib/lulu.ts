export const MANUAL_PRINT_STATUSES = [
  "draft",
  "pdf_ready",
  "submitted_manual",
  "submitted_api",
  "in_production",
  "shipped",
  "delivered",
  "failed",
] as const;

export type ManualPrintStatus = (typeof MANUAL_PRINT_STATUSES)[number];

type LuluAddress = {
  name: string;
  street1: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string;
  phone_number?: string;
};

type LuluCreatePrintJobInput = {
  externalId: string;
  title: string;
  interiorPdfUrl: string;
  coverPdfUrl: string;
};

type LuluPrintJobResponse = {
  id: string;
  status: string | null;
  trackingUrl: string | null;
  raw: unknown;
};

function getEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateShippingAddressJson(raw: string | null): string[] {
  if (!raw) {
    return [
      "Missing LULU_TEST_SHIPPING_ADDRESS_JSON (JSON object with name/street1/city/postcode/country_code)",
    ];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return ["LULU_TEST_SHIPPING_ADDRESS_JSON is not valid JSON"];
  }
  if (!parsed || typeof parsed !== "object") {
    return ["LULU_TEST_SHIPPING_ADDRESS_JSON must be a JSON object"];
  }

  const obj = parsed as Record<string, unknown>;
  const required = ["name", "street1", "city", "postcode", "country_code"] as const;
  const errors: string[] = [];
  for (const key of required) {
    if (typeof obj[key] !== "string" || !obj[key]?.trim()) {
      errors.push(`LULU_TEST_SHIPPING_ADDRESS_JSON.${key} is required`);
    }
  }
  return errors;
}

export function getLuluConfigValidationErrors(): string[] {
  const errors: string[] = [];
  if (!getEnv("LULU_CLIENT_KEY") && !getEnv("LULU_CLIENT_ID")) {
    errors.push("Missing LULU_CLIENT_KEY (or LULU_CLIENT_ID)");
  }
  if (!getEnv("LULU_CLIENT_SECRET")) {
    errors.push("Missing LULU_CLIENT_SECRET");
  }
  if (!getEnv("LULU_CONTACT_EMAIL")) {
    errors.push("Missing LULU_CONTACT_EMAIL");
  }
  if (!getEnv("LULU_POD_PACKAGE_ID")) {
    errors.push("Missing LULU_POD_PACKAGE_ID");
  }
  errors.push(...validateShippingAddressJson(getEnv("LULU_TEST_SHIPPING_ADDRESS_JSON")));
  return errors;
}

function getLuluClientKey(): string {
  const key = getEnv("LULU_CLIENT_KEY") ?? getEnv("LULU_CLIENT_ID");
  if (!key) {
    throw new Error("Missing LULU_CLIENT_KEY (or LULU_CLIENT_ID)");
  }
  return key;
}

function getLuluClientSecret(): string {
  const secret = getEnv("LULU_CLIENT_SECRET");
  if (!secret) {
    throw new Error("Missing LULU_CLIENT_SECRET");
  }
  return secret;
}

function getLuluApiBaseUrl(): string {
  return (
    getEnv("LULU_API_BASE_URL") ??
    getEnv("LULU_BASE_URL") ??
    "https://api.sandbox.lulu.com"
  ).replace(/\/$/, "");
}

function getLuluAuthUrl(): string {
  return (
    getEnv("LULU_AUTH_URL") ??
    `${getLuluApiBaseUrl()}/auth/realms/glasstree/protocol/openid-connect/token`
  );
}

function getPodPackageId(): string {
  const podPackageId = getEnv("LULU_POD_PACKAGE_ID");
  if (!podPackageId) {
    throw new Error("Missing LULU_POD_PACKAGE_ID");
  }
  return podPackageId;
}

function getShippingLevel(): string {
  return getEnv("LULU_SHIPPING_LEVEL") ?? "MAIL";
}

function getContactEmail(): string {
  const email = getEnv("LULU_CONTACT_EMAIL");
  if (!email) {
    throw new Error("Missing LULU_CONTACT_EMAIL");
  }
  return email;
}

function getTestShippingAddress(): LuluAddress {
  const raw = getEnv("LULU_TEST_SHIPPING_ADDRESS_JSON");
  const validationErrors = validateShippingAddressJson(raw);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }
  const parsed = JSON.parse(raw as string) as Record<string, unknown>;

  const address: LuluAddress = {
    name: String(parsed.name),
    street1: String(parsed.street1),
    city: String(parsed.city),
    postcode: String(parsed.postcode),
    country_code: String(parsed.country_code),
  };

  if (typeof parsed.state_code === "string" && parsed.state_code.trim()) {
    address.state_code = parsed.state_code;
  }
  if (typeof parsed.phone_number === "string" && parsed.phone_number.trim()) {
    address.phone_number = parsed.phone_number;
  }

  return address;
}

function readErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Unknown Lulu error";
  const obj = payload as Record<string, unknown>;
  if (typeof obj.detail === "string") return obj.detail;
  if (typeof obj.message === "string") return obj.message;
  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    return String(obj.errors[0]);
  }
  return "Unknown Lulu error";
}

async function luluRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getLuluAccessToken();
  const response = await fetch(`${getLuluApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const rawText = await response.text();
  let payload: unknown = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    throw new Error(
      `Lulu API request failed (${response.status} ${response.statusText}): ${readErrorMessage(
        payload
      )}`
    );
  }

  return payload as T;
}

export async function getLuluAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: getLuluClientKey(),
    client_secret: getLuluClientSecret(),
  });

  const response = await fetch(getLuluAuthUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const rawText = await response.text();
  let payload: unknown = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    throw new Error(
      `Lulu auth failed (${response.status} ${response.statusText}): ${readErrorMessage(payload)}`
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as { access_token?: unknown }).access_token !== "string"
  ) {
    throw new Error("Lulu auth did not return access_token");
  }

  return (payload as { access_token: string }).access_token;
}

function extractTrackingUrl(raw: Record<string, unknown>): string | null {
  if (typeof raw.tracking_url === "string" && raw.tracking_url.trim()) {
    return raw.tracking_url;
  }
  if (typeof raw.trackingUrl === "string" && raw.trackingUrl.trim()) {
    return raw.trackingUrl;
  }
  return null;
}

function extractStatus(raw: Record<string, unknown>): string | null {
  if (typeof raw.status === "string") {
    return raw.status;
  }
  if (raw.status && typeof raw.status === "object") {
    const statusObj = raw.status as Record<string, unknown>;
    if (typeof statusObj.name === "string") return statusObj.name;
  }
  return null;
}

export function mapLuluStatusToInternal(status: string | null | undefined): ManualPrintStatus {
  const normalized = (status ?? "").toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return "submitted_api";
  if (normalized.includes("error") || normalized.includes("failed")) return "failed";
  if (normalized.includes("delivered")) return "delivered";
  if (normalized.includes("shipped") || normalized.includes("in_transit")) return "shipped";
  if (
    normalized.includes("printing") ||
    normalized.includes("production") ||
    normalized.includes("manufacturing")
  ) {
    return "in_production";
  }
  return "submitted_api";
}

export async function createLuluPrintJob(
  input: LuluCreatePrintJobInput
): Promise<LuluPrintJobResponse> {
  const payload = {
    external_id: input.externalId,
    contact_email: getContactEmail(),
    shipping_level: getShippingLevel(),
    shipping_address: getTestShippingAddress(),
    line_items: [
      {
        external_id: `${input.externalId}-item-1`,
        title: input.title,
        quantity: 1,
        pod_package_id: getPodPackageId(),
        cover: input.coverPdfUrl,
        interior: input.interiorPdfUrl,
      },
    ],
  };

  const response = await luluRequest<Record<string, unknown>>("/print-jobs/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const id =
    typeof response.id === "string"
      ? response.id
      : typeof response.print_job_id === "string"
        ? response.print_job_id
        : null;

  if (!id) {
    throw new Error("Lulu create print job response did not include job id");
  }

  return {
    id,
    status: extractStatus(response),
    trackingUrl: extractTrackingUrl(response),
    raw: response,
  };
}

export async function getLuluPrintJob(printJobId: string): Promise<LuluPrintJobResponse> {
  const response = await luluRequest<Record<string, unknown>>(`/print-jobs/${printJobId}/`, {
    method: "GET",
  });

  return {
    id: printJobId,
    status: extractStatus(response),
    trackingUrl: extractTrackingUrl(response),
    raw: response,
  };
}

export function normalizeManualPrintStatus(value: string | null | undefined): ManualPrintStatus {
  if (!value) return "draft";
  if ((MANUAL_PRINT_STATUSES as readonly string[]).includes(value)) {
    return value as ManualPrintStatus;
  }
  return "draft";
}

export function toManualPrintStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeManualPrintStatus(status);
  return normalized.replace(/_/g, " ");
}
