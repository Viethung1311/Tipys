import * as Dialog from '@radix-ui/react-dialog';
import useDialogViewport from '../hooks/useDialogViewport.js';

/** The viewport centers content; animation only moves the inner panel. */
export default function Modal({ title, description, children }) {
  const viewportStyle = useDialogViewport(true);
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <div className="dialog-viewport" style={viewportStyle}>
          <Dialog.Content
            className="modal"
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
