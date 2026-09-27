import type { ValidationErrorIssue } from './types.js';

/**
 * Aggregated error thrown when one or more environment variables fail validation.
 * Lists all issues together in a clear, formatted message.
 */
export class EnvValidationError extends Error {
  public readonly issues: readonly ValidationErrorIssue[];

  constructor(issues: ValidationErrorIssue[]) {
    const formattedIssues = issues.map((issue) => `  - ${issue.key}: ${issue.message}`).join('\n');
    const message = `Environment validation failed:\n${formattedIssues}`;

    super(message);
    this.name = 'EnvValidationError';
    this.issues = Object.freeze([...issues]);

    // Restore prototype chain for instanceof checks across transpilations
    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnvValidationError);
    }
  }
}
