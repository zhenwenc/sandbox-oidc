import * as t from 'io-ts';
import { isEmpty } from 'ramda';
import { useAsync } from 'react-use';
import { Card, Text, Message } from '@navch-ui/core';

import { routes } from '@server/constants';

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
  params: Record<string, unknown>;
  /**
   * When `true`, the component will fetch and display the profile.
   */
  showDetails?: boolean;
};

export const SuccessResult = t.type({
  code: t.string,
  state: t.string,
});

export const FailureResult = t.type({
  error: t.string,
  error_details: t.string,
  state: t.union([t.string, t.undefined]),
});

export const InteractionResult: React.FC<InteractionResultProps> = props => {
  const { params, showDetails = false } = props;

  const fetchToken = useAsync(async () => {
    if (!showDetails || !SuccessResult.is(params)) return;

    const resp = await fetch(routes.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw resp.statusText;

    const data = await resp.json();
    if (data && data.error) throw data.error;

    return data;
  }, [JSON.stringify(params)]);

  const render = (title: string, data: ReturnType<typeof useAsync>) => {
    return data.error ? (
      <Message filled variant="error" title={title}>
        <Text component="pre" variant="subtitle1" scrollable muted>
          {JSON.stringify(data.error, null, 4)}
        </Text>
      </Message>
    ) : data.value ? (
      <Message filled variant="success" title={title}>
        <Text component="pre" variant="subtitle1" scrollable muted>
          {JSON.stringify(data.value, null, 4)}
        </Text>
      </Message>
    ) : (
      <Message filled variant="loading" title="Loading..." />
    );
  };

  return (
    <>
      <Card raised style={{ width: '100%', maxWidth: 600 }}>
        {render('Authenticated', { loading: isEmpty(params), value: params as unknown })}
      </Card>

      {showDetails && SuccessResult.is(params) && (
        <Card raised style={{ width: '100%', maxWidth: 600, maxHeight: '50vh' }} mt={3}>
          {render('Claims', fetchToken)}
        </Card>
      )}
    </>
  );
};
