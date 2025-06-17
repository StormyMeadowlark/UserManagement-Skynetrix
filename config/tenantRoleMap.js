const TenantRoleMap = {
  Shop: [
    "Owner",
    "General Manager",
    "Service Advisor",
    "Shop Foreman",
    "Master Technician",
    "A Technician",
    "B Technician",
    "Technician",
    "Lube Tech",
    "Parts Manager",
    "Front Desk",
    "Receptionist",
    "Other",
    "Employee",
  ],

  Agency: [
    "Owner",
    "Account Manager",
    "Brand Strategist",
    "SEO Specialist",
    "Content Creator",
    "Ad Buyer",
    "Social Media Manager",
    "Copywriter",
    "Web Developer",
    "Other",
    "Employee",
  ],

  Vendor: [
    "Owner",
    "Sales Rep",
    "Account Exec",
    "Inventory Manager",
    "Distributor Coordinator",
    "Customer Success Rep",
    "Other",
    "Employee",
  ],

  Fleet: [
    "Fleet Manager",
    "Dispatcher",
    "Maintenance Coordinator",
    "Driver",
    "Parts Procurement",
    "Other",
    "Employee",
  ],

  Partner: [
    "Partner Rep",
    "Trainer",
    "Integration Specialist",
    "Support Rep",
    "Other",
    "Employee",
  ],

  Reseller: [
    "Owner",
    "Account Manager",
    "Sales Rep",
    "Customer Onboarding",
    "Other",
    "Employee",
  ],

  APIOnly: [
    "System Integration",
    "Automation Script",
    "Bot",
    "Other",
    "Employee",
  ],

  Enterprise: [
    "Executive",
    "IT Admin",
    "Ops Manager",
    "Regional Manager",
    "Corporate Trainer",
    "Other",
    "Employee",
  ],

  PlatformAdmin: [
    "Platform Owner",
    "Support Agent",
    "Moderator",
    "Billing Admin",
    "Super Admin",
    "Other",
    "Employee",
  ],
};

module.exports = TenantRoleMap;
