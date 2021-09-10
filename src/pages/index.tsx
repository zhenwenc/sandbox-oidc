import { useState } from 'react';

import { Box, Button, Card, Text, Input, Modal, Form, FormField, useForm } from '@navch-ui/core';
import { useLatestCallback } from '@navch-ui/hooks';

import { ClientDetails, useOAuthClient } from '@services/client';
import { FullscreenLayout } from '@components/FullscreenLayout';
import { ClientTable } from '@components/ClientTable';

export default function Index() {
  const [isModalOpen, setModalOpen] = useState(false);
  const showModal = useLatestCallback(() => setModalOpen(true));
  const hideModal = useLatestCallback(() => setModalOpen(false));

  const oauth = useOAuthClient();
  const registrationForm = useForm<ClientDetails>({
    onSubmit: ({ values }) => {
      oauth.setClient(values);
      hideModal();
    },
  });

  return (
    <FullscreenLayout align="center" justify="start" style={{ overflow: 'auto' }}>
      <Card raised fluid mt={8} style={{ width: 800 }}>
        <Box padded baseline background="tint2" textAlign="center">
          <Text bold>{'Instructions'}</Text>
        </Box>
        <Box baseline flex align="center" justify="between">
          <Text padded>{'❶ Register an OIDC client (optional).'}</Text>
          <Button onClick={showModal} mh={2}>
            {'Register Client'}
          </Button>
        </Box>
        <Box baseline>
          <Text padded>{`❷ Add allowed redirect URL to client: ${oauth.redirectUri}.`}</Text>
        </Box>
        <Box>
          <Text padded>{`❸ Initiate authentication requests with an available client.`}</Text>
        </Box>
      </Card>

      <Card raised mt={4} style={{ width: 800 }}>
        <ClientTable />
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
