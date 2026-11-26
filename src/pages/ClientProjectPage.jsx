import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { portalService } from '../services/portalService';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ClientProjectUpdate from '../components/domain/ClientProjectUpdate';

/**
 * A signed-in client's screen for their own project: how much work is done and the reports the site team submits.
 * Staff never land here by themselves; the route sends only people who see just their own project (clients).
 */
export function ClientProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await portalService.getProjectUpdate(id));
    } catch (err) {
      setData(null);
      setError(err?.status === 404 ? 'We could not find this project.' : err?.message || 'We could not load this project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.project?.name || 'Your project'}
        breadcrumbs={[{ label: 'Projects', path: '/projects' }, { label: data?.project?.name || 'Project' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" leadingIcon="refresh" onClick={load} disabled={loading}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" leadingIcon="arrow-left" onClick={() => navigate('/projects')}>
              All Projects
            </Button>
          </div>
        }
      />

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState
          icon="warning"
          title="Project unavailable"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          }
        />
      ) : data ? (
        <ClientProjectUpdate data={data} />
      ) : null}
    </div>
  );
}

export default ClientProjectPage;
