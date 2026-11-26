import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { portalService } from '../services/portalService';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ClientProjectUpdate from '../components/domain/ClientProjectUpdate';

/**
 * The page behind a link staff share with a client (`/share/:token`). No login: the link itself is the credential,
 * so this lives outside the app shell and shows only the project update.
 */
export function SharedProjectPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // A private page: keep it out of search engines and do not pass the address on to other sites.
  useEffect(() => {
    const tags = [
      ['robots', 'noindex, nofollow'],
      ['referrer', 'no-referrer'],
    ].map(([name, content]) => {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    return () => tags.forEach((meta) => meta.remove());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    portalService
      .getPublicUpdate(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.status === 404 ? 'This link is not valid any more. Please ask your project coordinator for a new one.' : err?.message || 'We could not load this page.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold tracking-tight">Aesthetic Interiors</span>
          <span className="text-xs text-muted-foreground">Project update</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState icon="lock" title="Link unavailable" description={error} />
        ) : (
          <ClientProjectUpdate data={data} />
        )}
      </main>
    </div>
  );
}

export default SharedProjectPage;
