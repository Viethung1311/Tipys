import * as Dialog from '@radix-ui/react-dialog';
import useDialogViewport from '../hooks/useDialogViewport.js';
import { X } from 'lucide-react';
import '../styles/modal.css';
import { useRef } from 'react';

/** The viewport centers content; animation only moves the inner panel. */
export default function Modal({ title, description, children, onClose, className = '' }) {
  const viewportStyle = useDialogViewport(true);
  const returnFocus = useRef(document.activeElement);
  const heading = (
    <>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{description}</Dialog.Description>
    </>
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <div className="dialog-viewport" style={viewportStyle}>
          <Dialog.Content
            className={['modal', onClose && 'modal--closable', className].filter(Boolean).join(' ')}
            onEscapeKeyDown={(e) => {
              if (!onClose) e.preventDefault();
            }}
            onPointerDownOutside={(e) => e.preventDefault()}
            onCloseAutoFocus={(event) => {
              if (onClose && returnFocus.current?.isConnected) {
                event.preventDefault();
                returnFocus.current.focus();
              }
            }}
          >
            {onClose ? (
              <>
                <div className="tipy-modal-header">
                  <Dialog.Close asChild>
                    <button type="button" className="tipy-modal-close" aria-label="Đóng">
                      <X size={24} aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                  {heading}
                </div>
                <div className="tipy-modal-body">{children}</div>
              </>
            ) : (
              <>
                {heading}
                {children}
              </>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
