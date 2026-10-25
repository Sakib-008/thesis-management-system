"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "./Button";
import { Field, Input } from "./Form";
import { Modal } from "./Modal";

// Replaces window.confirm
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }>
      <p className="text-sm text-subtle">{message}</p>
    </Modal>
  );
}

// Replaces window.prompt: a one-field dialog used for "add" and "rename"
export function TextPromptDialog({ open, title, label, initial = "", confirmLabel = "Save", onSubmit, onCancel }: {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => { if (open) setValue(initial); }, [open, initial]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim().length >= 2) onSubmit(value.trim());
  }

  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="text-prompt-form">{confirmLabel}</Button>
        </>
      }>
      <form id="text-prompt-form" onSubmit={submit}>
        <Field label={label}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} minLength={2} maxLength={150} required autoFocus />
        </Field>
      </form>
    </Modal>
  );
}