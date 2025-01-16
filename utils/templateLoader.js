const fs = require("fs");
const path = require("path");

exports.loadTemplate = (templateName) => {
  const templatePath = path.join(
    __dirname,
    `../templates/${templateName}.html`
  );
  try {
    return fs.readFileSync(templatePath, "utf-8");
  } catch (error) {
    console.error("Error loading email template:", error);
    throw new Error("Template not found.");
  }
};
