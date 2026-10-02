// Compatibility adapter for older Pages deployments; Workers uses src/index.js.
import { handleReport } from '../../lib/analyze.js';
export { handleReport };
export const onRequest = context => handleReport(context);
