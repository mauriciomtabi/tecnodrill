import app from '../backend/src/server';

export default function handler(req: any, res: any) {
  if (req.query?.__path && typeof req.query.__path === 'string') {
    req.url = req.query.__path;
  } else if (req.headers && req.headers['x-matched-path']) {
    req.url = req.headers['x-matched-path'];
  }
  return app(req, res);
}

