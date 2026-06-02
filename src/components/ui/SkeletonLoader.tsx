import { memo } from 'react';
import { TableSkeleton, CardSkeleton } from '../Skeleton';
import Skeleton from './Skeleton';

interface SkeletonLoaderProps {
  type?: 'table' | 'form' | 'card' | 'detail';
  rows?: number;
}

const SkeletonLoader = memo(function SkeletonLoader({
  type = 'table',
  rows = 5,
}: SkeletonLoaderProps) {
  if (type === 'table') {
    return <TableSkeleton rows={rows} cols={4} />;
  }

  if (type === 'form') {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>
            <Skeleton variant="text" width="6rem" className="mb-2" />
            <Skeleton variant="text" className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <CardSkeleton key={i} lines={3} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-pulse">
      <Skeleton variant="text" width="40%" className="h-6" />
      <Skeleton variant="text" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="60%" />
    </div>
  );
});

export default SkeletonLoader;