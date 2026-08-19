export const CUSTOMERS = "/admin/customers";
export const CUSTOMERS_NEW = `${CUSTOMERS}/new`;

export const customerProfile = (id: string) => `${CUSTOMERS}/${id}`;
