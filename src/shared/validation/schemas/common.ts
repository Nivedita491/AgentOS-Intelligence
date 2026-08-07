/**
 * Shared Zod primitives for the validation layer.
 */

import { z } from 'zod';

/** RFC-4122 UUID string. */
export const uuidSchema = z.string().uuid();

/** A safe, non-empty display string with a max length. */
export const shortString = (max = 200, min = 1) =>
  z.string().min(min).max(max).trim();

/** Optional UUID that may be null. */
export const nullableUuid = z.string().uuid().nullable().optional();

/** ISO date string. */
export const isoDateSchema = z.string().datetime({ offset: true }).optional();

/** A positive integer within a bounded range. */
export const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);

/** A bounded array of short strings. */
export const stringArray = (maxItems = 50, itemMax = 200) =>
  z.array(z.string().min(1).max(itemMax).trim()).max(maxItems).optional();

/** Generic metadata object (loose, but bounded). */
export const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const organizationIdSchema = z.string().uuid();
