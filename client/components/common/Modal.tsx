import type { ReactNode } from 'react';
import { Button } from './Button.js';

type ModalProps = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function Modal({ title, children, confirmLabel, onConfirm, onCancel }: ModalProps) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">{title}</h2>
        <div className="modal-copy">{children}</div>
        <div className="modal-actions">
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </section>
    </div>
  );
}
