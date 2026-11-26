import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';
import ConfirmDialog from '../ui/ConfirmDialog';
import { portalService, shareUrl } from '../../services/portalService';
import { useToast } from '../../context/ToastContext';

/**
 * Staff give a client one private link for a project. Anyone holding it sees the project update without logging in,
 * so creating a new link replaces the old one, and the link can be switched off.
 */
export function ShareProjectLinkModal({ isOpen, onClose, project }) {
  const toast = useToast();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'replace' | 'revoke'

  const projectId = project?.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLink(await portalService.getLink(projectId));
    } catch (err) {
      toast.error(err?.message || 'Could not load the client link');
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (isOpen && projectId) load();
  }, [isOpen, projectId, load]);

  const create = async () => {
    setWorking(true);
    try {
      const created = await portalService.createLink(projectId);
      setLink(created);
      toast.success('Client link is ready to share');
    } catch (err) {
      toast.error(err?.message || 'Could not create the client link');
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const revoke = async () => {
    setWorking(true);
    try {
      await portalService.revokeLink(projectId);
      setLink(null);
      toast.success('Client link switched off');
    } catch (err) {
      toast.error(err?.message || 'Could not switch off the client link');
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const copy = async () => {
    const url = shareUrl(link.path);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it by hand.');
    }
  };

  const url = link ? shareUrl(link.path) : '';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Share with client"
        subtitle={project?.name}
        size="md"
        footer={
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : link ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send this link to your client. It shows how much work is done and the reports your team submits for this
              site, and needs no login.
            </p>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input label="Client link" value={url} readOnly onFocus={(e) => e.target.select()} />
              </div>
              <Button variant="primary" size="sm" leadingIcon="link" onClick={copy}>
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can open it. If it reaches the wrong person, create a new link: the old one stops
              working straight away.
            </p>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" leadingIcon="refresh" onClick={() => setConfirm('replace')} disabled={working}>
                Create new link
              </Button>
              <Button variant="danger" size="sm" leadingIcon="x-circle" onClick={() => setConfirm('revoke')} disabled={working}>
                Switch off
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              There is no client link for this project yet. Create one to let your client follow the work without
              logging in.
            </p>
            <Button variant="primary" size="sm" leadingIcon="link" loading={working} onClick={create}>
              Create client link
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirm === 'replace'}
        title="Create a new link?"
        message="The current link will stop working straight away. Anyone who has it will need the new one."
        confirmText="Create new link"
        confirmVariant="primary"
        loading={working}
        onConfirm={create}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        isOpen={confirm === 'revoke'}
        title="Switch off the client link?"
        message="The link will stop working straight away. You can create a new one any time."
        confirmText="Switch off"
        loading={working}
        onConfirm={revoke}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

export default ShareProjectLinkModal;
