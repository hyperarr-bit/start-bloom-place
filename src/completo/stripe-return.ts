/** Redirect parameters request a server lookup; they never prove payment. */
export function readStripeReturn(href:string):{pi:string;status:string}|undefined {
 const params=new URL(href).searchParams;
 const ids=params.getAll('payment_intent'),statuses=params.getAll('redirect_status');
 if(ids.length!==1||statuses.length!==1||!/^pi_[A-Za-z0-9]{1,100}$/.test(ids[0])||!['succeeded','processing','failed'].includes(statuses[0]))return;
 return {pi:ids[0],status:statuses[0]};
}
