import { useRef } from 'react';
import { Button } from './common/Button.js';

type BackupActionsProps = {
  usageBytes: number;
  busy: boolean;
  ready: boolean;
  onExport: () => void;
  onImport: (file: File) => void;
  onPrune: () => void;
  onShowApplications: () => void;
};

export function BackupActions({
  usageBytes,
  busy,
  ready,
  onExport,
  onImport,
  onPrune,
  onShowApplications,
}: BackupActionsProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="backup-actions">
      <span className="storage-usage">Storage {(usageBytes / (1024 * 1024)).toFixed(1)} MB</span>
      <Button disabled={!ready} onClick={onShowApplications}>Applications</Button>
      <Button disabled={busy || !ready} onClick={onExport}>Export JSON</Button>
      <Button disabled={busy || !ready} onClick={() => fileInput.current?.click()}>
        Import JSON
      </Button>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        aria-label="Import JSON backup"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.target.value = '';
        }}
      />
      <Button disabled={busy} onClick={onPrune}>Delete old reports</Button>
    </div>
  );
}
