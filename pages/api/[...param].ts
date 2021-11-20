import { NextApiRequest, NextApiResponse } from 'next';
import { middlewares } from '@navch/express';

import { buildHandler } from '../../server';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.info('--- what', req.url);
  const routes = middlewares.toCallback(buildHandler().routes());
  return middlewares.runMiddleware(req, res, routes);
}
export default handler;
