'use client';

import dynamic from 'next/dynamic';

const BackgroundNetwork = dynamic(
  () => import('./BackgroundNetwork'),
  { ssr: false }
);

export default function BackgroundNetworkLoader() {
  return <BackgroundNetwork />;
}
