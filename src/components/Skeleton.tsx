import { memo } from 'react';
import { motion } from 'framer-motion';

export const LayoutSkeleton = memo(function LayoutSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="h-16 bg-white border-b border-gray-200 animate-pulse">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded"></div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-24 bg-gray-200 rounded"></div>
            <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
      
      <div className="flex">
        <div className="w-64 bg-white border-r border-gray-200 p-4 animate-pulse">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
        
        <div className="flex-1 p-6">
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 rounded-lg"></div>
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-80 bg-gray-200 rounded-lg"></div>
              <div className="h-80 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const LoginSkeleton = memo(function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-800 to-blue-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-xl shadow-2xl p-8 animate-pulse">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto mb-4"></div>
            <div className="h-8 w-48 bg-gray-200 rounded mx-auto"></div>
          </div>
          
          <div className="space-y-4">
            <div className="h-12 bg-gray-100 rounded-lg"></div>
            <div className="h-12 bg-gray-100 rounded-lg"></div>
            <div className="h-12 bg-gray-500 rounded-lg"></div>
          </div>
          
          <div className="mt-6 text-center">
            <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export const LineSkeleton = memo(function LineSkeleton({ width = '100%', height = '1rem', className = '' }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
});

export const CardSkeleton = memo(function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse">
      <LineSkeleton width="60%" height="1.25rem" />
      {Array.from({ length: lines }).map((_, i) => (
        <LineSkeleton key={i} width={`${70 + i * 10}%`} height="0.875rem" />
      ))}
    </div>
  );
});

export const TableSkeleton = memo(function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="grid grid-cols-4 gap-4 mb-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, ci) => (
          <LineSkeleton key={`h-${ci}`} height="1rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="grid gap-4 py-2 border-t border-gray-100" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <LineSkeleton key={`r${ri}-${ci}`} height="0.875rem" width={`${70 + Math.random() * 30}%`} />
          ))}
        </div>
      ))}
    </div>
  );
});

export const PreviewSkeleton = memo(function PreviewSkeleton({ height = '400px' }: { height?: string }) {
  return (
    <div className="flex items-center justify-center animate-pulse" style={{ height }}>
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto" />
        <LineSkeleton width="200px" height="1rem" className="mx-auto" />
        <LineSkeleton width="160px" height="0.75rem" className="mx-auto" />
      </div>
    </div>
  );
});