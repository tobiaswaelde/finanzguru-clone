import { dashboardWidgetKeys } from '@finance/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { FinanceDatabase } from './drizzle.module.js';
import { category, dashboardLayout, dataSource, institution } from './schema.js';

const defaults = [
  ['Wohnen', 'expense', 'primary', ['Miete / Wohngeld', 'Strom', 'Wohnnebenkosten']],
  ['Lebenshaltung', 'expense', 'warning', ['Lebensmittel und Getränke', 'Handy, Festnetz und Internet', 'Sonstige']],
  ['Shopping und Unterhaltung', 'expense', 'info', []],
  ['Sparen und Anlegen', 'savings', 'success', ['Wertpapieranlage']],
  ['Versicherung', 'expense', 'primary', ['Risiko-Lebensversicherung']],
  ['Bank und Kredit', 'expense', 'info', []],
  ['Gesundheit und Wellness', 'expense', 'success', ['Arznei- und Heilmittel']],
  ['Freizeit, Hobbies und Soziales', 'expense', 'warning', []],
  ['Einnahmen', 'income', 'success', ['Gehalt', 'Sonstige Einnahmen']],
  ['Umbuchung', 'transfer', 'neutral', []],
] as const;

/** Insert seed defaults once; preserve existing rows and live source state. */
export function seedDefaults(db: FinanceDatabase): void {
  db.transaction((tx) => {
    if (!tx.select({ position: dashboardLayout.position }).from(dashboardLayout).limit(1).get()) {
      tx.insert(dashboardLayout)
        .values(dashboardWidgetKeys.map((widgetKey, position) => ({ widgetKey, position, visible: true })))
        .run();
    }
    tx.insert(institution).values({ name: 'Manuell' }).onConflictDoNothing().run();
    for (const [name, kind, color, children] of defaults) {
      tx.insert(category).values({ name, kind, color, isDefault: true }).onConflictDoNothing().run();
      const root = tx
        .select({ id: category.id })
        .from(category)
        .where(and(eq(category.name, name), isNull(category.parentId)))
        .get();
      if (!root) throw new Error('Seed category root missing');
      for (const child of children) {
        tx.insert(category)
          .values({ name: child, parentId: root.id, kind, color, isDefault: true })
          .onConflictDoNothing()
          .run();
      }
    }
    for (const source of [
      { kind: 'csv', status: 'active', displayName: 'CSV-Import' },
      { kind: 'sparkasse_fints', status: 'planned', displayName: 'Sparkasse (Live-Abfrage)' },
    ] as const) {
      if (!tx.select({ id: dataSource.id }).from(dataSource).where(eq(dataSource.kind, source.kind)).get()) {
        tx.insert(dataSource).values(source).run();
      }
    }
  });
}
