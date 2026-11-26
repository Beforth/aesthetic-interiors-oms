import React from 'react';
import { Spinner as BefSpinner } from './befui-spinner';
import { cn } from '../../lib/utils';

// BefUI's three sizes (https://befui.vercel.app/#/components/spinner); the medium one is the default
const SIZES = { sm: 'size-3', md: 'size-4', lg: 'size-6 border-[3px]' };

export function Spinner({ size = 'md', className = '' }) {
  return <BefSpinner className={cn(SIZES[size] || SIZES.md, className)} />;
}

export default Spinner;
