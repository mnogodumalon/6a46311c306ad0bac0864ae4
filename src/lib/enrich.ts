import type { EnrichedFahrzeugerfassung } from '@/types/enriched';
import type { Fahrerverwaltung, Fahrzeugerfassung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface FahrzeugerfassungMaps {
  fahrerverwaltungMap: Map<string, Fahrerverwaltung>;
}

export function enrichFahrzeugerfassung(
  fahrzeugerfassung: Fahrzeugerfassung[],
  maps: FahrzeugerfassungMaps
): EnrichedFahrzeugerfassung[] {
  return fahrzeugerfassung.map(r => ({
    ...r,
    fahrerName: resolveDisplay(r.fields.fahrer, maps.fahrerverwaltungMap, 'vorname', 'nachname'),
  }));
}
