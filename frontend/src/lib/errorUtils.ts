/**
 * Reusable error-message extraction and normalization utility for InfoLoom.
 * Converts raw FastAPI, Pydantic, HTTP, and JavaScript error payloads into
 * human-friendly, production-ready user messages.
 */

export interface PydanticErrorDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
  input?: any;
  ctx?: Record<string, any>;
}

export class ApiError extends Error {
  status?: number;
  raw?: any;

  constructor(message: string, status?: number, raw?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.raw = raw;
  }
}

/**
 * Normalizes Pydantic field validation errors into concise, user-friendly sentences.
 */
function formatPydanticErrors(errors: PydanticErrorDetail[], fallback: string): string {
  if (!Array.isArray(errors) || errors.length === 0) {
    return fallback;
  }

  const messages: string[] = [];

  for (const err of errors) {
    const loc = Array.isArray(err.loc)
      ? err.loc.map((l) => String(l).toLowerCase())
      : [];
    const msg = (err.msg || '').toLowerCase();
    const type = (err.type || '').toLowerCase();

    // 1. Email field validation
    if (loc.includes('email')) {
      if (
        type.includes('value_error') ||
        type.includes('email') ||
        msg.includes('valid email') ||
        msg.includes('@')
      ) {
        messages.push('Please enter a valid email address.');
      } else if (type.includes('missing') || msg.includes('field required')) {
        messages.push('Email address is required.');
      } else {
        messages.push('Please enter a valid email address.');
      }
      continue;
    }

    // 2. Password field validation
    if (loc.includes('password')) {
      if (type.includes('string_too_short') || msg.includes('at least') || msg.includes('short')) {
        messages.push('Password must be at least 6 characters long.');
      } else if (type.includes('string_too_long') || msg.includes('at most')) {
        messages.push('Password cannot exceed 72 characters.');
      } else if (type.includes('missing') || msg.includes('field required')) {
        messages.push('Password is required.');
      } else {
        messages.push('Password must meet the required requirements.');
      }
      continue;
    }

    // 3. Name field validation
    if (loc.includes('name')) {
      if (type.includes('missing') || msg.includes('field required')) {
        messages.push('Full name is required.');
      } else if (type.includes('string_too_short') || msg.includes('at least')) {
        messages.push('Full name cannot be blank.');
      } else {
        messages.push('Please enter your full name.');
      }
      continue;
    }

    // 4. General missing field
    if (type.includes('missing') || msg.includes('field required')) {
      const field = loc.filter((l) => l !== 'body')[0] || 'Required field';
      const cleanField = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
      messages.push(`${cleanField} is required.`);
      continue;
    }

    // 5. Clean up any other readable message
    if (err.msg) {
      const cleaned = err.msg
        .replace(/^value error,\s*/i, '')
        .replace(/^string should\s*/i, 'Must ')
        .trim();
      if (cleaned) {
        messages.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    }
  }

  if (messages.length > 0) {
    return Array.from(new Set(messages))[0];
  }

  return fallback;
}

/**
 * Normalizes text-based error messages.
 */
function formatTextError(text: string, status?: number, fallback = 'Something went wrong. Please try again.'): string {
  if (!text || typeof text !== 'string') return fallback;

  const lower = text.toLowerCase().trim();

  // Strip JSON strings if passed as string
  if (lower.startsWith('{') || lower.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      return extractErrorMessage(parsed, status, fallback);
    } catch {
      // not json, continue
    }
  }

  // Prevent "[object Object]"
  if (lower.includes('[object object]')) {
    return 'Please check your information and try again.';
  }

  // Duplicate email
  if (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('duplicate email') ||
    lower.includes('email is already')
  ) {
    return 'An account with this email already exists.';
  }

  // Incorrect email or password
  if (
    lower.includes('incorrect email or password') ||
    lower.includes('invalid credentials') ||
    lower.includes('wrong password') ||
    lower.includes('incorrect password')
  ) {
    return 'The email or password is incorrect.';
  }

  // User not found
  if (
    lower.includes('user not found') ||
    lower.includes('account not found') ||
    lower.includes('nonexistent')
  ) {
    return 'No account was found with this email address.';
  }

  // Session expired / Unauthorized
  if (
    lower.includes('could not validate credentials') ||
    lower.includes('token expired') ||
    lower.includes('invalid token') ||
    lower.includes('signature has expired') ||
    lower.includes('not authenticated')
  ) {
    return 'Your session has expired. Please sign in again.';
  }

  // Network / Connection errors
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('econnrefused') ||
    lower.includes('load failed') ||
    lower.includes('networkrequestfailed')
  ) {
    return 'Unable to connect to the server. Please check your connection and try again.';
  }

  // HTTP status code fallbacks
  if (status === 401) {
    return 'The email or password is incorrect.';
  }
  if (status === 403) {
    return 'You do not have permission to access this resource.';
  }
  if (status === 404) {
    return 'The requested resource was not found.';
  }
  if (status && status >= 500) {
    return 'A server error occurred. Please try again later.';
  }

  // Human-readable generic sentence passthrough
  if (
    text.length > 0 &&
    text.length < 120 &&
    !text.includes('{') &&
    !text.includes('[') &&
    !lower.includes('internal server error') &&
    !lower.includes('traceback')
  ) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  return fallback;
}

/**
 * Extracts a normalized, human-friendly error string from any error structure.
 */
export function extractErrorMessage(
  errData: any,
  status?: number,
  fallbackMessage = 'Something went wrong. Please try again.'
): string {
  if (!errData) {
    if (status === 401) return 'The email or password is incorrect.';
    if (status === 403) return 'You do not have permission to access this resource.';
    if (status === 404) return 'The requested resource was not found.';
    if (status && status >= 500) return 'A server error occurred. Please try again later.';
    return fallbackMessage;
  }

  // If already an ApiError
  if (errData instanceof ApiError) {
    return errData.message;
  }

  // If standard JS Error
  if (errData instanceof Error) {
    return formatTextError(errData.message, status, fallbackMessage);
  }

  // String payload
  if (typeof errData === 'string') {
    return formatTextError(errData, status, fallbackMessage);
  }

  // FastAPI detail property
  if (errData && errData.detail !== undefined) {
    if (typeof errData.detail === 'string') {
      return formatTextError(errData.detail, status, fallbackMessage);
    }
    if (Array.isArray(errData.detail)) {
      return formatPydanticErrors(errData.detail, fallbackMessage);
    }
    if (typeof errData.detail === 'object' && errData.detail !== null) {
      if (typeof errData.detail.message === 'string') {
        return formatTextError(errData.detail.message, status, fallbackMessage);
      }
      return fallbackMessage;
    }
  }

  // Pydantic array at root
  if (Array.isArray(errData)) {
    return formatPydanticErrors(errData, fallbackMessage);
  }

  // Object with message or error field
  if (typeof errData.message === 'string') {
    return formatTextError(errData.message, status, fallbackMessage);
  }
  if (typeof errData.error === 'string') {
    return formatTextError(errData.error, status, fallbackMessage);
  }

  return fallbackMessage;
}

/**
 * Convenience helper to be used in UI component catch blocks:
 * `setError(getErrorMessage(err));`
 */
export function getErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!err) return fallback;
  return extractErrorMessage(err, (err as any)?.status, fallback);
}
