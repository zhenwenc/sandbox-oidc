import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { Box, BoxLikeProps, Button, Text, OverlayContainer } from '@navch-ui/core';

export type FullscreenLayoutProps = BoxLikeProps & {
  readonly noHeader?: boolean;
};

export const FullscreenLayout: React.FC<FullscreenLayoutProps> = props => {
  const { children, noHeader, ...boxProps } = props;

  return (
    <Box flex column background="tint3" style={{ height: 'calc(100vh)' }}>
      <Head>
        <title>{'OIDC Demo'}</title>
      </Head>

      {!noHeader && (
        <Box flex fluid layer={1} pv={3} ph={5} align="center" background="tint2">
          <Link href="/">
            <Button variant="text">
              <Text variant="h6">{'Home'}</Text>
            </Button>
          </Link>
        </Box>
      )}

      <Box flex={1} column justify="center" align="center" {...boxProps}>
        {children}
      </Box>

      <OverlayContainer />
    </Box>
  );
};
