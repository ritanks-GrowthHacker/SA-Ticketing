'use client';

import React from 'react';

export const Card = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`bg-white rounded-lg shadow ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`px-6 py-4 border-b border-gray-200 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-lg font-semibold ${className}`} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`px-6 py-4 ${className}`} {...props}>
    {children}
  </div>
);
