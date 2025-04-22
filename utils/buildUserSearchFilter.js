const mongoose = require("mongoose");

const booleanFields = [
  "twoFactorEnabled",
  "marketing.email",
  "marketing.sms",
  "notifications.email",
  "notifications.sms",
  "notifications.push",
  "deleted",
];

const dateFields = [
  "birthday",
  "lastLoginAt",
  "lastActivityAt",
  "deletionScheduledAt",
  "createdAt",
  "updatedAt",
];

const exactMatchFields = [
  "tenantIds",
  "vehicles",
  "createdBy",
  "updatedBy",
  "shopwareUserId",
];

const stringFields = [
  "email",
  "phone",
  "secondaryPhone",
  "name",
  "role",
  "generalRole",
  "status",
  "preferences.language",
  "preferences.theme",
  "shopwareRole",
  "userPreferences.dashboardLayout",
  "address.addressLine1",
  "address.addressLine2",
  "address.city",
  "address.state",
  "address.zip",
  "address.country",
  "loginHistory.ipAddress",
  "loginHistory.device",
];

module.exports = function buildUserSearchFilter(query) {
  const filter = {};

  for (const key in query) {
    const value = query[key];

    if (stringFields.includes(key)) {
      filter[key] = { $regex: new RegExp(value, "i") };
    } else if (booleanFields.includes(key)) {
      filter[key] = value === "true";
    } else if (exactMatchFields.includes(key)) {
      if (mongoose.Types.ObjectId.isValid(value)) {
        filter[key] = value;
      }
    } else if (dateFields.includes(key)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        filter[key] = date;
      }
    }
  }

  return filter;
};
