import React from 'react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';

/**
 * Reusable placeholder screen for upcoming phases.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {string} props.icon
 * @param {string} [props.phase]
 */
export function PlaceholderPage({
  title,
  subtitle,
  icon = 'folder',
  phase = 'Phase 2 / Phase 3',
}) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: title },
        ]}
      />

      <div className="py-8">
        <EmptyState
          icon={icon}
          title={`${title} Module`}
          description={`The ${title} interface is scheduled for full implementation in ${phase} of the Aesthetic Interiors Operations Management System.`}
          action={
            <Link to="/dashboard">
              <Button variant="secondary" size="sm" leadingIcon="arrow-left">
                Back to Dashboard
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}

export default PlaceholderPage;
