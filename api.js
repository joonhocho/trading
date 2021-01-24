const { createHmac } = require("crypto");

exports.signMessage = (message, secret) =>
  createHmac("sha256", secret).update(message).digest("hex");

exports.serializeParams = (params) =>
  Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
