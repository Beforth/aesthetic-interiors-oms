import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { userService } from '../../services/userService';
import { useToast } from '../../context/ToastContext';

const EMPTY = { first: '', next: '', confirm: '' };

/** First message the server gave for a field, or ''. */
function serverMessage(err, field) {
  const value = err?.errors?.[field];
  return Array.isArray(value) ? value[0] : value || '';
}

/**
 * Two password fields plus a "confirm" and a first field that proves who is asking. Shared by "Change my password"
 * and "Reset a staff member's password" so both look and behave the same.
 */
function PasswordFormModal({ isOpen, onClose, title, subtitle, firstLabel, firstField, firstHelper, nextLabel, submitLabel, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.first) next.first = firstField === 'adminPassword' ? 'Enter your own password.' : 'Enter your current password.';
    if (!form.next || form.next.length < 8) next.next = 'Use at least 8 characters.';
    else if (form.next !== form.confirm) next.confirm = 'The two passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await onSubmit(form.first, form.next);
      onClose();
    } catch (err) {
      const fromServer = {
        first: serverMessage(err, firstField),
        next: serverMessage(err, 'newPassword'),
      };
      if (fromServer.first || fromServer.next) setErrors(fromServer);
      else setErrors({ next: err?.message || 'Could not change the password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" autoComplete="off">
        <Input
          label={firstLabel}
          required
          leadingIcon="lock"
          type="password"
          autoComplete="current-password"
          value={form.first}
          onChange={(e) => setForm({ ...form, first: e.target.value })}
          error={errors.first}
          helperText={firstHelper}
        />
        <Input
          label={nextLabel}
          required
          leadingIcon="lock"
          type="password"
          autoComplete="new-password"
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
          error={errors.next}
          helperText="At least 8 characters; not too common and not only numbers"
        />
        <Input
          label="Confirm new password"
          required
          leadingIcon="lock"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          error={errors.confirm}
        />
        {/* lets Enter submit the form */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}

/** The signed-in person changes their own password (needs the current one). */
export function ChangePasswordModal({ isOpen, onClose }) {
  const toast = useToast();
  return (
    <PasswordFormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Change password"
      subtitle="Choose a new password for your own account"
      firstLabel="Current password"
      firstField="currentPassword"
      nextLabel="New password"
      submitLabel="Change password"
      onSubmit={async (current, next) => {
        await userService.changeMyPassword(current, next);
        toast.success('Your password has been changed');
      }}
    />
  );
}

/** An administrator sets a staff member's password after confirming with their own. */
export function ResetPasswordModal({ isOpen, onClose, user }) {
  const toast = useToast();
  return (
    <PasswordFormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset password"
      subtitle={user ? `Set a new password for ${user.name}` : ''}
      firstLabel="Your password"
      firstField="adminPassword"
      firstHelper="Enter your own password to confirm it is you."
      nextLabel={user ? `New password for ${user.name}` : 'New password'}
      submitLabel="Reset password"
      onSubmit={async (adminPassword, next) => {
        await userService.resetUserPassword(user.id, adminPassword, next);
        toast.success(`Password reset for ${user.name}`);
      }}
    />
  );
}
