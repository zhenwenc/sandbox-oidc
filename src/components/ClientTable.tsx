import React from 'react';
import { Box, Button, Text, Table, TableColumnProps, IconClose, IconEdit, IconPets } from '@navch-ui/core';
import { useLatestCallback } from '@navch-ui/hooks';

import { ClientInfo } from '@services/client';

export type ClientTableProps = {
  clients: ClientInfo[];
  onAuthorize: (client: ClientInfo) => unknown;
  onModifyClient: (client: ClientInfo) => unknown;
  onRemoveClient: (client: ClientInfo) => unknown;
};

const IssuerPane = ({ row }: { row: ClientInfo }) => {
  return (
    <Text ellipsis title={row.issuer}>
      {row.issuer}
    </Text>
  );
};

export const ClientTable: React.FC<ClientTableProps> = props => {
  const { clients, onAuthorize, onModifyClient, onRemoveClient } = props;

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
          <Button
            title="Authorize"
            variant="outlined"
            onClick={useLatestCallback(() => {
              onAuthorize(row.original);
            })}
          >
            <IconPets />
          </Button>
          <Button
            title="Modify OIDC Client"
            variant="outlined"
            ml={1}
            disabled={row.original.remote}
            onClick={() => onModifyClient(row.original)}
          >
            <IconEdit />
          </Button>
          <Button
            title="Delete OIDC Client"
            variant="outlined"
            ml={1}
            disabled={row.original.remote}
            onClick={() => onRemoveClient(row.original)}
          >
            <IconClose />
          </Button>
        </Box>
      )),
    },
  ];

  return <Table data={clients} columns={columns} />;
};
