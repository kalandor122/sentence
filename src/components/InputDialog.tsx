import { useEffect, useState } from "react";
import Modal from "./Modal";

interface InputDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  multiline?: boolean;
  validate?: () => string | null;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export default function InputDialog({
  open,
  title,
  description,
  label,
  initialValue = "",
  placeholder,
  confirmLabel = "Insert",
  multiline = false,
  validate,
  onClose,
  onSubmit,
}: InputDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [initialValue, open]);

  const change = (next: string) => {
    setValue(next);
    setError(null);
  };

  const submit = () => {
    if (!value.trim()) return;
    const message = validate?.() ?? null;
    if (message) {
      setError(message);
      return;
    }
    onSubmit(value.trim());
    onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="button" disabled={!value.trim()} onClick={submit}>{confirmLabel}</button>
        </>
      }
    >
      <label className="dialog-field">
        <span>{label}</span>
        {multiline ? (
          <textarea
            autoFocus
            value={value}
            placeholder={placeholder}
            rows={4}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "input-dialog-error" : undefined}
            onChange={(event) => change(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
            }}
          />
        ) : (
          <input
            autoFocus
            value={value}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "input-dialog-error" : undefined}
            onChange={(event) => change(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        )}
        {error ? <span className="dialog-field-error" id="input-dialog-error" role="alert">{error}</span> : null}
      </label>
    </Modal>
  );
}
