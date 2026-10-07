// Compatibility adapter for older Pages deployments; Workers uses src/index.js.
import { handlePayment } from '../../lib/payment.js';
export const onRequest = context => handlePayment(context);
