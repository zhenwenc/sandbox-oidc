import { useState } from 'react';

import {
  Box,
  Button,
  Card,
  Text,
  Table,
  TableColumnProps,
  IconClose,
  Input,
  Modal,
  Form,
  FormField,
  useForm,
} from '@navch-ui/core';
import { useLatestCallback } from '@navch-ui/hooks';

import { ClientInfo, ClientDetails, useOAuthClient } from '@services/client';
import { FullscreenLayout } from '@components/FullscreenLayout';

export default function Index() {
  const [isModalOpen, setModalOpen] = useState(false);
  const showModal = useLatestCallback(() => setModalOpen(true));
  const hideModal = useLatestCallback(() => setModalOpen(false));

  const client = useOAuthClient();
  const registrationForm = useForm<ClientDetails>({
    onSubmit: ({ values }) => {
      client.setClient(values);
      hideModal();
    },
  });

  const columns: TableColumnProps<ClientInfo>[] = [
    {
      id: 'issuer',
      span: 4,
      flexGrow: 1,
      renderCell: ({ cell }) => (
        <Text ellipsis title={cell.value}>
          {cell.value}
        </Text>
      ),
    },
    {
      id: 'client_id',
      span: 3,
      renderCell: ({ cell }) => (
        <Text ellipsis title={cell.value}>
          {cell.value}
        </Text>
      ),
    },
    {
      id: 'operations',
      span: 1,
      flexGrow: 1,
      renderCell: ({ row }) => (
        <Box fluid flex>
          <Button variant="outlined" onClick={() => client.authroze(row.original.client_id)}>
            {'Authorize'}
          </Button>
          <Button
            variant="outlined"
            ml={2}
            disabled={row.original.remote}
            onClick={() => client.removeClient(row.original)}
          >
            <IconClose />
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <FullscreenLayout align="center" justify="start" style={{ overflow: 'auto' }}>
      <Card raised fluid mt={8} style={{ width: 800 }}>
        <Box padded baseline background="tint2" textAlign="center">
          <Text bold>{'Instructions'}</Text>
        </Box>
        <Box flex padded align="center" justify="between">
          <Text>{'❶ Register an OIDC client (optional).'}</Text>
          <Button onClick={showModal}>{'Register Client'}</Button>
        </Box>
        <Text padded>{`❷ Add allowed redirect URL to client: ${client.redirectUri}.`}</Text>
        <Text padded>{`❸ Initiate authentication requests with an available client.`}</Text>
      </Card>

      <Card raised mt={4} style={{ width: 800 }}>
        <Table
          data={client.values}
          columns={columns}
          bodyProps={{ style: { maxHeight: '80vh' }, scrollable: true }}
        />
      </Card>

      <Modal
        title="OIDC Client Registration"
        style={{ minWidth: 600 }}
        isOpen={isModalOpen}
        onCancel={hideModal}
        onConfirm={registrationForm.submit}
      >
        <Form form={registrationForm}>
          <FormField field="issuer" required>
            <Input autoFocus />
          </FormField>
          <FormField field="client_id" required>
            <Input />
          </FormField>
          <FormField field="client_secret" required>
            <Input />
          </FormField>
        </Form>
      </Modal>
    </FullscreenLayout>
  );
}
