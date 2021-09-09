import { Card } from '@navch-ui/core';

import { VerificationCodePane } from './VerificationCodePane';

export const Basic = () => (
  <Card raised>
    <VerificationCodePane />
  </Card>
);

export default {
  title: 'Components/VerificationCodePane',
  component: VerificationCodePane,
};
