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
  onClose,
  onSubmit,
}: InputDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [initialValue, open]);

  const submit = () => {
    if (!value.trim()) return;
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
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
            }}
          />
        ) : (
          <input
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        )}
      </label>
    </Modal>
  );
}
