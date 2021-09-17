import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { Box, BoxLikeProps, Button, Text, OverlayContainer } from '@navch-ui/core';

export type LayoutProps = BoxLikeProps & {
  readonly noHeader?: boolean;
};

export const Layout: React.FC<LayoutProps> = props => {
  const { children, noHeader, ...boxProps } = props;

  return (
    <Box flex column background="tint3" style={{ minHeight: 'calc(100vh)' }}>
      <Head>
        <title>{'OIDC • Sandbox'}</title>
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

      <Box flex={1} column pv={8} justify="center" align="center" {...boxProps}>
        {children}
      </Box>

      <OverlayContainer />
    </Box>
  );
};
