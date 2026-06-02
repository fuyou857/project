import { useState, useEffect, useRef } from 'react';
import { Spinner } from './Loading';

interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  placeholder?: React.ReactNode;
  fallback?: string;
}

const LazyImage = ({
  src,
  alt = '',
  className = '',
  placeholder,
  fallback = '/placeholder-image.png',
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setIsError(true);
  };

  const defaultPlaceholder = (
    <div className="flex items-center justify-center bg-gray-100 rounded">
      <Spinner size="md" />
    </div>
  );

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {isVisible && (
        <>
          {!isLoaded && !isError && (placeholder || defaultPlaceholder)}
          <img
            src={isError ? fallback : src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
            }`}
          />
        </>
      )}
      {!isVisible && (
        <div className="bg-gray-100 animate-pulse w-full h-full" />
      )}
    </div>
  );
};

export default LazyImage;