const TenantRoleMap = require("../config/tenantRoleMap");

function validateRolesForTenant(tenantType, rolesArray) {
  const allowedRoles = TenantRoleMap[tenantType] || [];

  return rolesArray.every(
    (roleObj) =>
      typeof roleObj.type === "string" && allowedRoles.includes(roleObj.type)
  );
}
