import packageInfo from '../package.json';
import env from './env';

const app = {
  version: packageInfo.version,
  name: 'SoftCheck',
  logoUrl: 'https://i.postimg.cc/5y36hBk6/Untitled-Artwork-2.webp',
  url: env.appUrl,
};

export default app;
