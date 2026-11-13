import {expect,it} from 'vitest';
import {readStripeReturn} from '@/completo/stripe-return';
it('recognizes only one valid payment intent and return state',()=>{
 expect(readStripeReturn('https://www.coreaplicativo.com.br/completo?payment_intent=pi_123&redirect_status=processing')).toEqual({pi:'pi_123',status:'processing'});
 for(const query of ['','payment_intent=nope&redirect_status=succeeded','payment_intent=pi_a&payment_intent=pi_b&redirect_status=succeeded','payment_intent=pi_a&redirect_status=whatever'])expect(readStripeReturn('https://www.coreaplicativo.com.br/completo?'+query)).toBeUndefined();
});
