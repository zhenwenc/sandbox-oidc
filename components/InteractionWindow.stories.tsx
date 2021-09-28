import { Box, Button, Divider } from '@navch-ui/core';

import { InteractionResult } from './InteractionResult';
import { useInteractionWindow } from './InteractionWindow';

export const Authorize = () => {
  const [result, handleAuthorize] = useInteractionWindow();
  return (
    <Box>
      <Button fluid loading={result.loading} disabled={result.loading} onClick={handleAuthorize}>
        {'Click To Authorize'}
      </Button>
      <Divider />
      {result.value && <InteractionResult params={result.value} showDetails />}
    </Box>
  );
};

export default {
  title: 'Components/InteractionWindow',
};
