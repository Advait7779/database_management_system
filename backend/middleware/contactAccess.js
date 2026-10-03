const ADMIN_ROLES = ['super_admin', 'admin'];

const hasContactAccess = (user) =>
  ADMIN_ROLES.includes(user?.role) || user?.allow_contact_access === true;

const maskMobile = (mobile) => {
  if (!mobile) return mobile;
  const value = String(mobile).trim();
  return value.length <= 5 ? 'x'.repeat(value.length) : `${value.slice(0, -5)}xxxxx`;
};

const contactForUser = (contact, user) =>
  hasContactAccess(user) ? contact : { ...contact, mobile: maskMobile(contact.mobile) };

module.exports = { hasContactAccess, maskMobile, contactForUser };
