import React from 'react';

type FormLabelProps = {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
};

export default function FormLabel({ children, htmlFor, required, className = '' }: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`ui-label mb-2 block font-medium text-gray-600 ${className}`}
    >
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  );
}
