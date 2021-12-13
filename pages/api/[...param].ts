import { NextApiRequest, NextApiResponse } from 'next';
import { middlewares } from '@navch/http';

import { buildHandler } from '../../server';

export const config = {
  api: {
    bodyParser: false,
  },
};

const routes = middlewares.toCallback(buildHandler().routes());
async function handler(req: NextApiRequest, res: NextApiResponse) {
  return middlewares.runMiddleware(req, res, routes);
}
export default handler;
