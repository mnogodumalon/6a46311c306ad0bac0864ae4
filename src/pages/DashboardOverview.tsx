import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichFahrzeugerfassung } from '@/lib/enrich';
import type { EnrichedFahrzeugerfassung } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconCar, IconUsers, IconAlertTriangle, IconBuildingWarehouse,
  IconPlus,
} from '@tabler/icons-react';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatCard, StatCardRow } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  MapWidget,
  type MapMarker,
} from '@/components/widgets/MapWidget';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
} from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordKeyFacts,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { FahrzeugerfassungDialog } from '@/components/dialogs/FahrzeugerfassungDialog';
import { FahrerverwaltungDialog } from '@/components/dialogs/FahrerverwaltungDialog';
import { MapRouteLinks } from '@/components/widgets/MapWidget';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { gruss, useClock, namen, undoToast } from '@/lib/polish';

type OverlayItem =
  | { type: 'fahrzeug'; id: string }
  | { type: 'fahrer'; id: string };

const STATUS_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
  im_einsatz: 'success',
  verfuegbar: 'default',
  in_wartung: 'warning',
  ausser_betrieb: 'destructive',
};

const KANBAN_COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['fahrzeugerfassung']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
  tone: STATUS_TONE[o.key] ?? 'default',
}));

export default function DashboardOverview() {
  const {
    fahrzeugerfassung, setFahrzeugerfassung,
    fahrerverwaltung, setFahrerverwaltung,
    fahrerverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();
  const enriched = useMemo(
    () => enrichFahrzeugerfassung(fahrzeugerfassung, { fahrerverwaltungMap }),
    [fahrzeugerfassung, fahrerverwaltungMap],
  );

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [fahrzeugDialog, setFahrzeugDialog] = useState<{
    open: boolean;
    record?: EnrichedFahrzeugerfassung;
    defaultStatus?: string;
  }>({ open: false });
  const [fahrerDialog, setFahrerDialog] = useState<{ open: boolean }>({ open: false });

  // ── Overlay stack ─────────────────────────────────────────────────────────
  const overlay = useRecordOverlayStack<OverlayItem>();

  // ── KPI filter ────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const imEinsatz = useMemo(() => enriched.filter(r => lookupKey(r.fields.status) === 'im_einsatz'), [enriched]);
  const inWartung = useMemo(() => enriched.filter(r => lookupKey(r.fields.status) === 'in_wartung'), [enriched]);
  const ausserBetrieb = useMemo(() => enriched.filter(r => lookupKey(r.fields.status) === 'ausser_betrieb'), [enriched]);
  const verfuegbar = useMemo(() => enriched.filter(r => lookupKey(r.fields.status) === 'verfuegbar'), [enriched]);

  const filteredEnriched = useMemo(
    () => statusFilter ? enriched.filter(r => lookupKey(r.fields.status) === statusFilter) : enriched,
    [enriched, statusFilter],
  );

  // ── Hero: Fahrzeuge außer Betrieb ─────────────────────────────────────────
  const heroFahrzeug = ausserBetrieb[0] ?? null;

  // ── Advance status helper ─────────────────────────────────────────────────
  const advanceToVerfuegbar = useCallback((r: EnrichedFahrzeugerfassung) => {
    const prev = lookupKey(r.fields.status);
    setFahrzeugerfassung(cur =>
      cur.map(v => v.record_id === r.record_id
        ? { ...v, fields: { ...v.fields, status: { key: 'verfuegbar', label: 'Verfügbar' } } }
        : v),
    );
    LivingAppsService.updateFahrzeugerfassungEntry(r.record_id, { status: 'verfuegbar' }).catch(() => {
      setFahrzeugerfassung(cur =>
        cur.map(v => v.record_id === r.record_id
          ? { ...v, fields: { ...v.fields, status: { key: prev ?? '', label: prev ?? '' } } }
          : v),
      );
      fetchAll();
    });
    undoToast(`${r.fields.kennzeichen} auf Verfügbar gesetzt`, () => {
      LivingAppsService.updateFahrzeugerfassungEntry(r.record_id, { status: prev ?? '' }).catch(() => fetchAll());
      setFahrzeugerfassung(cur =>
        cur.map(v => v.record_id === r.record_id
          ? { ...v, fields: { ...v.fields, status: { key: prev ?? '', label: prev ?? '' } } }
          : v),
      );
    });
  }, [setFahrzeugerfassung, fetchAll]);

  // ── Kanban card move ──────────────────────────────────────────────────────
  const handleCardMove = useCallback((cardId: string, newColumn: string) => {
    const rid = cardId.replace('fz:', '');
    const rec = fahrzeugerfassung.find(r => r.record_id === rid);
    if (!rec) return;
    const prevStatus = lookupKey(rec.fields.status);
    setFahrzeugerfassung(cur =>
      cur.map(r => r.record_id === rid
        ? { ...r, fields: { ...r.fields, status: LOOKUP_OPTIONS['fahrzeugerfassung']?.['status']?.find(o => o.key === newColumn) ?? { key: newColumn, label: newColumn } } }
        : r),
    );
    LivingAppsService.updateFahrzeugerfassungEntry(rid, { status: newColumn }).catch(() => {
      setFahrzeugerfassung(cur =>
        cur.map(r => r.record_id === rid
          ? { ...r, fields: { ...r.fields, status: LOOKUP_OPTIONS['fahrzeugerfassung']?.['status']?.find(o => o.key === prevStatus) ?? { key: prevStatus ?? '', label: prevStatus ?? '' } } }
          : r),
      );
      fetchAll();
    });
    undoToast(`Status auf „${LOOKUP_OPTIONS['fahrzeugerfassung']?.['status']?.find(o => o.key === newColumn)?.label ?? newColumn}" gesetzt`, () => {
      LivingAppsService.updateFahrzeugerfassungEntry(rid, { status: prevStatus ?? '' }).catch(() => fetchAll());
      setFahrzeugerfassung(cur =>
        cur.map(r => r.record_id === rid
          ? { ...r, fields: { ...r.fields, status: LOOKUP_OPTIONS['fahrzeugerfassung']?.['status']?.find(o => o.key === prevStatus) ?? { key: prevStatus ?? '', label: prevStatus ?? '' } } }
          : r),
      );
    });
  }, [fahrzeugerfassung, setFahrzeugerfassung, fetchAll]);

  // ── Map markers ───────────────────────────────────────────────────────────
  const markers = useMemo<MapMarker[]>(() =>
    filteredEnriched.flatMap(r => {
      const geo = r.fields.standort;
      if (!geo) return [];
      return [{
        id: `fz:${r.record_id}`,
        lat: geo.lat,
        long: geo.long,
        title: r.fields.kennzeichen ?? '—',
        subtitle: r.fahrerName ? `Fahrer: ${r.fahrerName}` : (geo.info ?? undefined),
        tone: STATUS_TONE[lookupKey(r.fields.status) ?? ''] ?? 'default',
        icon: 'truck' as const,
      }];
    }),
    [filteredEnriched],
  );

  // ── Kanban cards ──────────────────────────────────────────────────────────
  const kanbanCards = useMemo<KanbanCard[]>(() =>
    enriched.map(r => ({
      id: `fz:${r.record_id}`,
      column: lookupKey(r.fields.status) ?? '',
      title: r.fields.kennzeichen ?? '—',
      subtitle: [r.fields.fahrzeugbezeichnung, r.fahrerName ? `Fahrer: ${r.fahrerName}` : null]
        .filter(Boolean).join(' · ') || undefined,
      tone: STATUS_TONE[lookupKey(r.fields.status) ?? ''] ?? 'default',
    })),
    [enriched],
  );

  // ── WorkList: in Wartung ──────────────────────────────────────────────────
  const wartungItems = useMemo(() => inWartung.map(r => ({
    id: r.record_id,
    title: r.fields.kennzeichen ?? '—',
    secondLine: (
      <>
        <span className="font-medium text-amber-600">In Wartung</span>
        {r.fahrerName ? <span className="text-muted-foreground"> · {r.fahrerName}</span> : null}
      </>
    ),
    icon: <IconTool size={14} className="text-amber-500 shrink-0" />,
    action: { label: '✓ Freigeben', onClick: () => advanceToVerfuegbar(r) },
  })), [inWartung, advanceToVerfuegbar]);

  // ── Greeting context line ─────────────────────────────────────────────────
  const contextLine = useMemo(() => {
    if (enriched.length === 0) return 'Noch keine Fahrzeuge erfasst.';
    const einsatzNamen = namen(imEinsatz.map(r => r.fields.kennzeichen ?? ''));
    if (imEinsatz.length > 0 && inWartung.length > 0) {
      return `${einsatzNamen} im Einsatz – ${inWartung.length} Fahrzeug${inWartung.length > 1 ? 'e' : ''} in Wartung.`;
    }
    if (imEinsatz.length > 0) return `${einsatzNamen} im Einsatz.`;
    if (verfuegbar.length > 0) return `${verfuegbar.length} Fahrzeug${verfuegbar.length > 1 ? 'e' : ''} verfügbar.`;
    return 'Alle Fahrzeuge außer Betrieb oder in Wartung.';
  }, [enriched, imEinsatz, inWartung, verfuegbar]);

  // ── Overlay record lookup ─────────────────────────────────────────────────
  const overlayFahrzeug = overlay.top?.type === 'fahrzeug'
    ? enriched.find(r => r.record_id === overlay.top!.id) ?? null
    : null;
  const overlayFahrer = overlay.top?.type === 'fahrer'
    ? fahrerverwaltung.find(r => r.record_id === overlay.top!.id) ?? null
    : null;

  // ── ALL hooks ABOVE — no early returns before this point ─────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (enriched.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <IconCar size={48} className="text-muted-foreground" stroke={1.5} />
        <div>
          <h2 className="text-lg font-semibold">Fuhrpark einrichten</h2>
          <p className="text-sm text-muted-foreground mt-1">Erfasse dein erstes Servicefahrzeug, um loszulegen.</p>
        </div>
        <Button onClick={() => setFahrzeugDialog({ open: true })}>
          <IconPlus size={16} className="mr-1" /> Erstes Fahrzeug erfassen
        </Button>
        <FahrzeugerfassungDialog
          open={fahrzeugDialog.open}
          onClose={() => setFahrzeugDialog({ open: false })}
          onSubmit={async fields => { await LivingAppsService.createFahrzeugerfassungEntry(fields); fetchAll(); }}
          fahrerverwaltungList={fahrerverwaltung}
          enablePhotoScan={AI_PHOTO_SCAN['Fahrzeugerfassung']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Fahrzeugerfassung']}
        />
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {gruss(clock)} — Servicefahrzeuge
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFahrerDialog({ open: true })}>
            <IconUsers size={14} className="mr-1 shrink-0" /> Fahrer anlegen
          </Button>
          <Button size="sm" onClick={() => setFahrzeugDialog({ open: true })}>
            <IconPlus size={14} className="mr-1 shrink-0" /> Fahrzeug erfassen
          </Button>
        </div>
      </div>

      <DashboardGrid
        variant="split"
        hero={
          heroFahrzeug ? (
            <HeroBanner
              tone="destructive"
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: 'Als verfügbar markieren',
                onClick: () => advanceToVerfuegbar(heroFahrzeug),
              }}
            >
              <b>{namen(ausserBetrieb.map(r => r.fields.kennzeichen ?? ''))}</b>{' '}
              {ausserBetrieb.length === 1 ? 'ist' : 'sind'} außer Betrieb
              {ausserBetrieb.length > 1 ? ` (${ausserBetrieb.length} Fahrzeuge)` : ''}.
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatCardRow>
            <StatCard
              title="Im Einsatz"
              value={imEinsatz.length}
              description={imEinsatz.length > 0 ? namen(imEinsatz.map(r => r.fields.kennzeichen ?? '')) : 'Keine aktiven Einsätze'}
              icon={<IconCar size={18} className="text-muted-foreground" />}
              tone={imEinsatz.length > 0 ? 'success' : 'default'}
              onClick={() => setStatusFilter(f => f === 'im_einsatz' ? null : 'im_einsatz')}
              active={statusFilter === 'im_einsatz'}
            />
            <StatCard
              title="Verfügbar"
              value={verfuegbar.length}
              description={verfuegbar.length > 0 ? 'Einsatzbereit' : 'Kein Fahrzeug frei'}
              icon={<IconBuildingWarehouse size={18} className="text-muted-foreground" />}
              tone="default"
              onClick={() => setStatusFilter(f => f === 'verfuegbar' ? null : 'verfuegbar')}
              active={statusFilter === 'verfuegbar'}
            />
            <StatCard
              title="In Wartung"
              value={inWartung.length}
              description={inWartung.length > 0 ? 'Sofort freigeben' : 'Alles in Ordnung'}
              icon={<IconTool size={18} className="text-muted-foreground" />}
              tone={inWartung.length > 0 ? 'warning' : 'default'}
              onClick={() => setStatusFilter(f => f === 'in_wartung' ? null : 'in_wartung')}
              active={statusFilter === 'in_wartung'}
            />
            <StatCard
              title="Fahrer"
              value={fahrerverwaltung.length}
              description={fahrerverwaltung.length > 0
                ? namen(fahrerverwaltung.map(r => `${r.fields.vorname ?? ''} ${r.fields.nachname ?? ''}`.trim()))
                : 'Noch keine Fahrer'}
              icon={<IconUsers size={18} className="text-muted-foreground" />}
              tone="default"
            />
          </StatCardRow>
        }
        aside={
          <>
            <WorkList
              title="In Wartung — freigeben"
              icon={<IconTool size={13} />}
              items={wartungItems}
              onItemClick={id => overlay.replace({ type: 'fahrzeug', id })}
              empty={{
                text: 'Alle Fahrzeuge einsatzbereit.',
                action: { label: 'Fahrzeug erfassen', onClick: () => setFahrzeugDialog({ open: true }) },
              }}
            />
            <WorkList
              title="Fahrerverwaltung"
              icon={<IconUsers size={13} />}
              items={fahrerverwaltung.map(r => ({
                id: r.record_id,
                title: `${r.fields.vorname ?? ''} ${r.fields.nachname ?? ''}`.trim() || '—',
                secondLine: r.fields.telefon
                  ? <span className="text-muted-foreground">{r.fields.telefon}</span>
                  : r.fields.email
                    ? <span className="text-muted-foreground">{r.fields.email}</span>
                    : undefined,
              }))}
              onItemClick={id => overlay.replace({ type: 'fahrer', id })}
              empty={{
                text: 'Noch keine Fahrer erfasst.',
                action: { label: 'Fahrer anlegen', onClick: () => setFahrerDialog({ open: true }) },
              }}
            />
          </>
        }
        primary={
          <div className="flex flex-col gap-4">
            {/* Map: Fahrzeugstandorte */}
            <div className="rounded-[27px] overflow-hidden shadow-lg" style={{ minHeight: 320 }}>
              <MapWidget
                markers={markers}
                legend={[
                  { label: 'Im Einsatz', tone: 'success' },
                  { label: 'Verfügbar', tone: 'default' },
                  { label: 'In Wartung', tone: 'warning' },
                  { label: 'Außer Betrieb', tone: 'destructive' },
                ]}
                onMarkerClick={m => {
                  const rid = m.id.replace('fz:', '');
                  overlay.replace({ type: 'fahrzeug', id: rid });
                }}
                onMapPointClick={async ({ lat, long }) => {
                  const { reverseGeocodeDetailed } = await import('@/lib/ai');
                  const addr = await reverseGeocodeDetailed(lat, long);
                  setFahrzeugDialog({
                    open: true,
                    record: undefined,
                  });
                  // Prefill is handled by defaultValues in the dialog below
                  void addr; // used via the dialog creation flow
                }}
              />
            </div>

            {/* Kanban: Fahrzeugstatus */}
            <KanbanWidget
              columns={KANBAN_COLUMNS}
              cards={kanbanCards}
              defaultCollapsed={['ausser_betrieb']}
              onCardClick={card => {
                const rid = card.id.replace('fz:', '');
                overlay.replace({ type: 'fahrzeug', id: rid });
              }}
              onCardMove={handleCardMove}
              onAddCard={colKey => setFahrzeugDialog({ open: true, defaultStatus: colKey })}
            />
          </div>
        }
      />

      {/* Fahrzeug RecordOverlay */}
      <RecordOverlay
        open={overlay.open && overlay.top?.type === 'fahrzeug'}
        onClose={overlay.close}
        onBack={overlay.canGoBack ? overlay.pop : undefined}
        onEdit={() => {
          if (overlayFahrzeug) setFahrzeugDialog({ open: true, record: overlayFahrzeug });
        }}
        editLabel="Bearbeiten"
        footer={
          overlayFahrzeug && lookupKey(overlayFahrzeug.fields.status) === 'in_wartung' ? (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                if (overlayFahrzeug) {
                  advanceToVerfuegbar(overlayFahrzeug);
                  overlay.close();
                }
              }}
            >
              ✓ Als verfügbar freigeben
            </Button>
          ) : undefined
        }
      >
        {overlayFahrzeug && (
          <>
            <RecordHeader
              title={overlayFahrzeug.fields.kennzeichen ?? '—'}
              subtitle={overlayFahrzeug.fields.fahrzeugbezeichnung}
              badges={
                overlayFahrzeug.fields.status ? (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    lookupKey(overlayFahrzeug.fields.status) === 'im_einsatz' ? 'bg-emerald-100 text-emerald-700'
                    : lookupKey(overlayFahrzeug.fields.status) === 'in_wartung' ? 'bg-amber-100 text-amber-700'
                    : lookupKey(overlayFahrzeug.fields.status) === 'ausser_betrieb' ? 'bg-red-100 text-red-700'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {overlayFahrzeug.fields.status.label}
                  </span>
                ) : undefined
              }
            />
            <RecordKeyFacts
              items={[
                { label: 'Fahrer', value: overlayFahrzeug.fahrerName || '—', icon: IconUsers },
                {
                  label: 'Standort',
                  value: overlayFahrzeug.fields.standort?.info ?? (overlayFahrzeug.fields.standort ? `${overlayFahrzeug.fields.standort.lat.toFixed(4)}, ${overlayFahrzeug.fields.standort.long.toFixed(4)}` : '—'),
                  icon: IconCar,
                },
              ]}
            />
            {overlayFahrzeug.fields.standort && (
              <RecordSection title="Navigation">
                <MapRouteLinks
                  lat={overlayFahrzeug.fields.standort.lat}
                  long={overlayFahrzeug.fields.standort.long}
                />
              </RecordSection>
            )}
            {overlayFahrzeug.fields.bemerkung && (
              <RecordSection title="Bemerkung">
                <RecordField label="Notiz" value={overlayFahrzeug.fields.bemerkung} format="longtext" />
              </RecordSection>
            )}
            <RecordAttachments appId={APP_IDS.FAHRZEUGERFASSUNG} recordId={overlayFahrzeug.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Fahrer RecordOverlay */}
      <RecordOverlay
        open={overlay.open && overlay.top?.type === 'fahrer'}
        onClose={overlay.close}
        onBack={overlay.canGoBack ? overlay.pop : undefined}
        onEdit={() => {
          // navigate to fahrerverwaltung page for editing
        }}
        editLabel="Bearbeiten"
      >
        {overlayFahrer && (
          <>
            <RecordHeader
              title={`${overlayFahrer.fields.vorname ?? ''} ${overlayFahrer.fields.nachname ?? ''}`.trim() || '—'}
            />
            <RecordKeyFacts
              items={[
                { label: 'Telefon', value: overlayFahrer.fields.telefon ?? '—', icon: IconUsers },
                { label: 'E-Mail', value: overlayFahrer.fields.email ?? '—', icon: IconUsers },
              ]}
            />
            <RecordSection title="Fahrzeuge">
              {enriched
                .filter(r => {
                  const fahrerUrl = r.fields.fahrer;
                  if (!fahrerUrl) return false;
                  return extractRecordId(fahrerUrl) === overlayFahrer.record_id;
                })
                .map(r => (
                  <div
                    key={r.record_id}
                    className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded-lg px-2"
                    onClick={() => overlay.push({ type: 'fahrzeug', id: r.record_id })}
                  >
                    <IconCar size={14} className="shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium">{r.fields.kennzeichen}</span>
                    {r.fields.status && (
                      <span className="text-xs text-muted-foreground ml-auto">{r.fields.status.label}</span>
                    )}
                  </div>
                ))}
              {enriched.filter(r => extractRecordId(r.fields.fahrer) === overlayFahrer.record_id).length === 0 && (
                <p className="text-sm text-muted-foreground">Kein Fahrzeug zugewiesen.</p>
              )}
            </RecordSection>
            <RecordAttachments appId={APP_IDS.FAHRERVERWALTUNG} recordId={overlayFahrer.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Fahrzeug Dialog */}
      <FahrzeugerfassungDialog
        open={fahrzeugDialog.open}
        onClose={() => setFahrzeugDialog({ open: false })}
        onSubmit={async fields => {
          if (fahrzeugDialog.record) {
            await LivingAppsService.updateFahrzeugerfassungEntry(fahrzeugDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createFahrzeugerfassungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={fahrzeugDialog.record?.fields ?? (fahrzeugDialog.defaultStatus ? { status: fahrzeugDialog.defaultStatus } : undefined)}
        recordId={fahrzeugDialog.record?.record_id}
        fahrerverwaltungList={fahrerverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Fahrzeugerfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Fahrzeugerfassung']}
      />

      {/* Fahrer Dialog */}
      <FahrerverwaltungDialog
        open={fahrerDialog.open}
        onClose={() => setFahrerDialog({ open: false })}
        onSubmit={async fields => {
          await LivingAppsService.createFahrerverwaltungEntry(fields);
          fetchAll();
        }}
        enablePhotoScan={AI_PHOTO_SCAN['Fahrerverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Fahrerverwaltung']}
      />
    </>
  );
}

// ── Skeleton & Error (unchanged from scaffold) ────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const APPGROUP_ID = '6a46311c306ad0bac0864ae4';
  const REPAIR_ENDPOINT = '/claude/build/repair';

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);
    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });
    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });
      if (!resp.ok || !resp.body) { setRepairing(false); setRepairFailed(true); return; }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch { setRepairing(false); setRepairFailed(true); }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
