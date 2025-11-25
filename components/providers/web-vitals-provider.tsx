'use client';

import { useEffect } from 'react';
import { initWebVitals } from '@/lib/web-vitals';

export function WebVitalsProvider() {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null; // This component doesn't render anything
}
