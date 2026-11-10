let counter = 0;

/**
 * Returns an id unique within the document, for wiring ARIA relationships
 * (`aria-controls`, `aria-activedescendant`, `aria-labelledby`) across shadow roots.
 */
export function uniqueId(prefix = 'bare'): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}
