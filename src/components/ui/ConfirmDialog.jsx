import React from 'react';
import Modal from './Modal';
import Button from './Button';
import Icon from './Icon';

/**
 * Confirmation dialog for destructive or critical user operations.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {function(): void} props.onConfirm
 * @param {function(): void} props.onCancel
 * @param {string} [props.title='Confirm Action']
 * @param {string} props.message
 * @param {string} [props.confirmText='Confirm']
 * @param {string} [props.cancelText='Cancel']
 * @param {'danger'|'primary'} [props.confirmVariant='danger']
 * @param {boolean} [props.loading=false]
 */
export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 py-1">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            confirmVariant === 'danger'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon
            name={confirmVariant === 'danger' ? 'danger' : 'info'}
            size={20}
          />
        </div>
        <div className="text-sm text-foreground leading-relaxed">
          {message}
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
