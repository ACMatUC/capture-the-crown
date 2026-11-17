import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  id: string;
  title: string;
  open: boolean;
  className?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({
  id,
  title,
  open,
  className,
  closeLabel,
  onClose,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      id={id}
      className={className}
      aria-labelledby={`${id}Title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className={`dialog-top ${className ? `${className}-header` : ""}`}>
        <h2 id={`${id}Title`}>{title}</h2>
        <button className="close-button" onClick={onClose} aria-label={closeLabel}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
