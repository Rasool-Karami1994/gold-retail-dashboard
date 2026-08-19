export const CUSTOMER_ROOT = "/customer";
export const CUSTOMER_TRANSACTIONS = `${CUSTOMER_ROOT}/transactions`;
export const CUSTOMER_PROFILE = `${CUSTOMER_ROOT}/profile`;

export const customerTransaction = (id: string) =>
  `${CUSTOMER_TRANSACTIONS}/${id}`;
