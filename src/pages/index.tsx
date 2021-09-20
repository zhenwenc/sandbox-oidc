import { useState, useEffect } from 'react';
import { source as markdown } from 'common-tags';
import Markdown from 'markdown-to-jsx';

import {
  Box,
  Button,
  Card,
  Text,
  Input,
  Modal,
  Form,
  FormField,
  Expansion,
  Labeled,
  Tooltip,
  Switch,
  IconPin,
  IconHelpOutline,
  useForm,
} from '@navch-ui/core';
import { useLatestCallback } from '@navch-ui/hooks';
import { useMount } from 'react-use';

import { ClientInfo, ClientDetails, ClientAuthParams, useOAuthClient } from '@services/client';
import { Layout } from '@components/Layout';
import { ClientTable } from '@components/ClientTable';

export default function Index() {
  const [isExpanded, setExpanded] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const showModal = useLatestCallback(() => setModalOpen(true));
  const hideModal = useLatestCallback(() => setModalOpen(false));

  const [selectedClient, setSelectedClient] = useState<ClientDetails>();

  const oauth = useOAuthClient();

  const registrationForm = useForm<ClientDetails>({
    onSubmit: useLatestCallback(({ values }) => {
      oauth.setClient({ ...values, id: selectedClient?.id });
      setSelectedClient(undefined);
      hideModal();
    }),
  });

  const authParamsForm = useForm<ClientAuthParams>({
    onChange: ({ values }) => {
      oauth.setAuthParams(values);
    },
  });

  const handleEditClient = useLatestCallback((info: ClientInfo) => {
    const client = oauth.getStoredClient(info);
    if (!client) {
      throw new Error(`No client found with ${JSON.stringify(info)}`);
    }
    setSelectedClient(client);
    setModalOpen(true);
  });

  // Synchronize client customizations to storage
  useEffect(() => {
    oauth.setAuthParams({ enabled: isExpanded });
  }, [isExpanded]);

  // Rehydrate client customizations when mounted
  useMount(() => {
    const authParams = oauth.getAuthParams();
    setExpanded(authParams.enabled ?? false);
    authParamsForm.findField('login_hint', true).setValue(authParams.login_hint);
  });

  const instructions = [
    {
      name: 'Register an OIDC client',
      hints: markdown`
        Apart from the predefined OIDC clients, you can also hook up your own OIDC
        providers. They must support Authorization Code Flow.

        <br/>

        The client credentials are stored in your browser's local storage. They will
        be sent to, and temporarily stored on, the server-side before initiating an
        authentication request for authorization code exchange.

        <br/>

        Use a sandbox OIDC client should you have security concerns. You are welcome
        to inspect the source code of this application.
      `,
      actions: <Button onClick={showModal}>{'Register Client'}</Button>,
    },
    {
      name: `Add allowed redirect URI to client: ${oauth.redirectUri}`,
    },
    {
      name: 'Specify extra authorization parameters',
      hints: markdown`
        The specified parameters will be sent as part of the authentication requests.
        Note that they may not be the same as defined in the OIDC specification, read
        the source code for details.

        <br/>

        The application does **not** validate the given parameter values, they will be
        forwarded as it is. The interpretation of the parameters is determined by the
        targeted OIDC provider, read their documentation for reference.

        <br/>

        The values are persisted across consecutive authentication requests.
      `,
      actions: <Switch checked={isExpanded} onChange={setExpanded} ph={5} />,
      expansion: (
        <Expansion expanded={isExpanded} animated>
          <Form form={authParamsForm} padded>
            <FormField
              span={6}
              field="login_hint"
              label="Login Hint"
              hint="Prepopulated value for authentication prompts"
            >
              <Input />
            </FormField>
            <FormField
              span={6}
              field="ui_locales"
              label="UI Locales"
              hint="Space-separated list of preferred languages"
            >
              <Input />
            </FormField>
          </Form>
        </Expansion>
      ),
    },
    {
      name: 'Initiate authentication request with an available client',
      hints: markdown`
        The actual authentication requests are generated on the server-side with
        desire default parameters.

        <br/>

        You will be redirected to the callback screen once authenticated.
      `,
    },
  ];

  return (
    <Layout scrollable align="center" justify="start">
      <Card raised fluid style={{ width: 800, maxWidth: '100vw' }}>
        <Box padded baseline background="tint2" textAlign="center">
          <Text bold>{'Instructions'}</Text>
        </Box>

        {instructions.map(({ name, hints, actions, expansion }, idx) => {
          const tooltip = hints && (
            <Tooltip
              title={
                <Box style={{ maxWidth: 500 }}>
                  <Markdown
                    options={{
                      overrides: {
                        p: {
                          component: Text,
                          props: { variant: 'subtitle2', inverse: true },
                        },
                      },
                    }}
                  >
                    {hints}
                  </Markdown>
                </Box>
              }
              placement="right"
            >
              <Text style={{ lineHeight: 1 }}>
                <IconHelpOutline />
              </Text>
            </Tooltip>
          );
          return (
            <Box key={name} topline={idx > 0}>
              <Box flex align="center" justify="between">
                <Labeled padded prefixIcon={<IconPin />} suffixIcon={tooltip}>
                  <Text>{name}</Text>
                </Labeled>
                <Box ph={2}>{actions}</Box>
              </Box>
              {expansion}
            </Box>
          );
        })}
      </Card>

      <Card raised mt={4} style={{ width: 800, maxWidth: '100vw' }}>
        <ClientTable
          clients={oauth.clients}
          onAuthorize={oauth.authorize}
          onModifyClient={handleEditClient}
          onRemoveClient={oauth.removeClient}
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
          <FormField field="issuer" defaultValue={selectedClient?.issuer} required>
            <Input autoFocus />
          </FormField>
          <FormField field="client_id" defaultValue={selectedClient?.client_id} required>
            <Input />
          </FormField>
          <FormField field="client_secret" defaultValue={selectedClient?.client_secret} required>
            <Input />
          </FormField>
        </Form>
      </Modal>
    </Layout>
  );
}
