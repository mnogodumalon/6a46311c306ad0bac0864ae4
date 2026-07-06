import { useState } from 'react';
import type { Fahrzeugerfassung, Fahrerverwaltung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconChevronDown } from '@tabler/icons-react';
import { GeoMapPicker } from '@/components/GeoMapPicker';
import { MapRouteLinks } from '@/components/widgets/MapWidget';

interface FahrzeugerfassungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Fahrzeugerfassung | null;
  onEdit: (record: Fahrzeugerfassung) => void;
  fahrerverwaltungList: Fahrerverwaltung[];
}

export function FahrzeugerfassungViewDialog({ open, onClose, record, onEdit, fahrerverwaltungList }: FahrzeugerfassungViewDialogProps) {
  const [showCoords, setShowCoords] = useState(false);

  function getFahrerverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return fahrerverwaltungList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fahrzeugerfassung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kennzeichen</Label>
            <p className="text-sm">{record.fields.kennzeichen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fahrzeugbezeichnung</Label>
            <p className="text-sm">{record.fields.fahrzeugbezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fahrer</Label>
            <p className="text-sm">{getFahrerverwaltungDisplayName(record.fields.fahrer)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Aktueller Standort</Label>
            {record.fields.standort?.info && (
              <p className="text-sm text-muted-foreground break-words whitespace-normal">{record.fields.standort.info}</p>
            )}
            {record.fields.standort?.lat != null && record.fields.standort?.long != null && (
              <GeoMapPicker
                lat={record.fields.standort.lat}
                lng={record.fields.standort.long}
                readOnly
              />
            )}
            {record.fields.standort?.lat != null && record.fields.standort?.long != null && (
              <MapRouteLinks lat={record.fields.standort.lat} long={record.fields.standort.long} className="mt-1" />
            )}
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 max-sm:py-2 transition-colors" onClick={() => setShowCoords(v => !v)}>
              {showCoords ? 'Koordinaten verbergen' : 'Koordinaten anzeigen'}
              <IconChevronDown className={`h-3 w-3 transition-transform ${showCoords ? "rotate-180" : ""}`} />
            </button>
            {showCoords && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-xs text-muted-foreground">Breitengrad:</span> {record.fields.standort?.lat?.toFixed(6) ?? '—'}</div>
                <div><span className="text-xs text-muted-foreground">Längengrad:</span> {record.fields.standort?.long?.toFixed(6) ?? '—'}</div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkung ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.FAHRZEUGERFASSUNG} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}