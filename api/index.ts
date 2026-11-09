import { createApp } from '../backend/src/app.js';

let appInstance: any = null;

export default function handler(req: any, res: any) {
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance(req, res);
}
