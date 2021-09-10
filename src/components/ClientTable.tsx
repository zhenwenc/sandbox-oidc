import React from 'react';
import { Box, Button, Text, Table, TableColumnProps, IconClose } from '@navch-ui/core';
import { useLatestCallback } from '@navch-ui/hooks';

import { ClientInfo, useOAuthClient } from '@services/client';

const IssuerPane = ({ row }: { row: ClientInfo }) => {
  return (
    <Text ellipsis title={row.issuer}>
      {row.issuer}
    </Text>
  );
};

export const ClientTable: React.VFC = () => {
  const { clients, authorize, removeClient } = useOAuthClient();

  const columns: TableColumnProps<ClientInfo>[] = [
    {
      id: 'issuer',
      span: 4,
      flexGrow: 1,
      renderCell: useLatestCallback(({ row }) => <IssuerPane row={row.original} />),
    },
    {
      id: 'client_id',
      span: 3,
      renderCell: useLatestCallback(({ cell }) => (
        <Text ellipsis title={cell.value}>
          {cell.value}
        </Text>
      )),
    },
    {
      id: 'operations',
      span: 1,
      flexGrow: 1,
      renderCell: useLatestCallback(({ row }) => (
        <Box fluid flex>
          <Button variant="outlined" onClick={() => authorize(row.original)}>
            {'Authorize'}
          </Button>
          <Button
            variant="outlined"
            ml={2}
            disabled={row.original.remote}
            onClick={() => removeClient(row.original)}
          >
            <IconClose />
          </Button>
        </Box>
      )),
    },
  ];

  return <Table data={clients} columns={columns} />;
};
