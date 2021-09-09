import { FC } from 'react';
import { isEmpty } from 'ramda';
import { useAsync } from 'react-use';
import { Card, Text, Message } from '@navch-ui/core';

type InteractionResultProps = {
  /**
   * Authentication results from the callback URL, either
   *
   *   { code: string, state: string }
   *
   * or
   *
   *   { error: string, error_details: string }
   */
  params: Record<string, string>;
  /**
   * When `true`, the component will fetch and display the profile.
   */
  showDetails?: boolean;
};

export const InteractionResult: FC<InteractionResultProps> = props => {
  const { params, showDetails = false } = props;

  const fetchToken = useAsync(async () => {
    if (!showDetails || !params.code || !params.state) return;

    const resp = await fetch('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw resp.statusText;

    const data = await resp.json();
    if (data && data.error) throw data.error;

    return data;
  }, [params.code, params.state]);

  const render = (title: string, data: ReturnType<typeof useAsync>) => {
    return data.error ? (
      <Message filled kind="error" title={title}>
        <Text component="pre" variant="subtitle1" scrollable muted>
          {JSON.stringify(data.error, null, 4)}
        </Text>
      </Message>
    ) : data.value ? (
      <Message filled kind="success" title={title}>
        <Text component="pre" variant="subtitle1" scrollable muted>
          {JSON.stringify(data.value, null, 4)}
        </Text>
      </Message>
    ) : (
      <Message filled kind="loading" title="Loading..." />
    );
  };

  return (
    <>
      <Card raised style={{ width: '100%', maxWidth: 600 }}>
        {render('Authenticated', { loading: isEmpty(params), value: params as unknown })}
      </Card>

      {showDetails && (
        <Card raised style={{ width: '100%', maxWidth: 600, maxHeight: '50vh' }} mt={3}>
          {render('Claims', fetchToken)}
        </Card>
      )}
    </>
  );
};
