import { z } from 'zod';
import { dashboardWidgetKeys } from '../enums.js';

export const dashboardWidgetSchema = z.object({
  widgetKey: z.enum(dashboardWidgetKeys),
  position: z
    .int()
    .min(0)
    .max(dashboardWidgetKeys.length - 1),
  visible: z.boolean(),
});

export const dashboardLayoutSchema = z
  .array(dashboardWidgetSchema)
  .length(dashboardWidgetKeys.length)
  .refine(
    /** Require unique keys and positions so each widget has a stable ordinal. */
    (items) =>
      new Set(items.map((item) => item.widgetKey)).size === items.length &&
      new Set(items.map((item) => item.position)).size === items.length,
    'Expected unique widget keys and positions',
  );
