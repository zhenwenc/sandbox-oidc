import { parse } from 'query-string';
import { isEmpty } from 'ramda';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Message } from '@navch-ui/core';

import { FullscreenLayout } from '@components/FullscreenLayout';
import { InteractionResult } from '@components/InteractionResult';

export default function CallbackScreen() {
  const router = useRouter();
  const query = router.asPath.includes('#') ? parse(router.asPath.split('#', 2)[1]) : router.query;

  const [params, setParams] = useState<Record<string, string>>();
  useEffect(() => {
    console.debug('[CallbackScreen] Parsed params:', query);

    if (isEmpty(query)) return;
    setParams(query as Record<string, string>);
  }, [JSON.stringify(query)]);

  return (
    <FullscreenLayout noHeader>
      {params ? (
        <InteractionResult params={params} showDetails={true} />
      ) : (
        <Message filled kind="loading" title="Loading..." />
      )}
    </FullscreenLayout>
  );
}
