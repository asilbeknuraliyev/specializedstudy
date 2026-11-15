export function validPassword(value:unknown,min=8):value is string {
 return typeof value==='string'&&value.length>=min&&value.length<=128&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/[0-9]/.test(value);
}
export const passwordPolicyMessage='Parolda kamida 8 belgi, katta va kichik lotin harfi hamda raqam bo‘lsin.';
