import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import Skeleton from '../ui/Skeleton';

const OnlyOfficeEditorInner = lazy(() => import('./OnlyOfficeEditor'));

export { preloadOnlyOfficeEnvironment } from './OnlyOfficeEditor';

type OnlyOfficeEditorProps = ComponentProps<typeof OnlyOfficeEditorInner>;

export default function OnlyOfficeEditorLazy(props: OnlyOfficeEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center" style={{ height: props.height || '600px' }}>
          <div className="w-full max-w-2xl space-y-4 p-8">
            <Skeleton variant="card" height={400} />
            <Skeleton variant="text" rows={3} />
          </div>
        </div>
      }
    >
      <OnlyOfficeEditorInner {...props} />
    </Suspense>
  );
}