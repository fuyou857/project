import { motion } from 'framer-motion';

export function LayoutSkeleton() {
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
}

export function LoginSkeleton() {
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
}