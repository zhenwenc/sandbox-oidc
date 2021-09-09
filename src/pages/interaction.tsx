import { useRouter } from 'next/router';
import { Card, Mask } from '@navch-ui/core';
import { useLatestCallback } from '@navch-ui/hooks';

import { FullscreenLayout } from '@components/FullscreenLayout';
import { VerificationCodePane } from '@components/VerificationCodePane';

export default function InteractionScreen() {
  const { query, isPreview } = useRouter();
  const { reply_to, login_hint } = query;

  const handleSubmit = useLatestCallback(async (code: string) => {
    if (typeof reply_to !== 'string') {
      throw new Error('Expected "reply_to" from query parameter');
    }
    window.location.href = reply_to + `?code=${code}`;
  });

  return (
    <FullscreenLayout noHeader>
      <Card raised>
        {/* This screen may have pre-rendered on the server-side */}
        <Mask loading={isPreview}>
          <VerificationCodePane
            initialValue={typeof login_hint === 'string' ? login_hint : undefined}
            onSubmit={handleSubmit}
          />
        </Mask>
      </Card>
    </FullscreenLayout>
  );
}
