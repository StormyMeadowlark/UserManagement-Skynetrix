const axios = require("axios");
const TENANT_SERVICE_URL =
  process.env.TENANT_SERVICE_URL || "http://localhost:8312/api/v2/tenants";

const getAccessibleTenantIds = async (user) => {
  const { tenantId, tenantType, userRole } = user;

  // 🔓 Platform Admins with tenantAdmin role can see all users
  if (tenantType === "Platform Admin" && userRole === "tenantAdmin") {
    const res = await axios.get(`${TENANT_SERVICE_URL}/active`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    return res.data?.data?.map((t) => t._id) || [];
  }

  // ✅ Tenant Admin or Admin gets their tenant + linked tenants
  if (["tenantAdmin", "admin"].includes(userRole)) {
    const res = await axios.get(
      `${TENANT_SERVICE_URL}/${tenantId}/linked-tenants`,
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );

    const linkedTenants = res.data?.data?.map((t) => t._id) || [];
    return [tenantId, ...linkedTenants];
  }

  // ❌ Default: No access
  return [];
};

module.exports = getAccessibleTenantIds;