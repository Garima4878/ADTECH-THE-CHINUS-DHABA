// Set deployment-specific values here; never put gateway secrets in frontend code.
window.CHINU_CONFIG = window.CHINU_CONFIG || {
  apiBaseUrl: "",
  onlinePayments: false,
  // AI menu chat service (ai-assistant/), e.g. "http://localhost:4001". Empty = no chat button.
  aiAssistantUrl: "",
  // Admin dashboard URL for the "Restaurant staff" link in the footer. Empty = no link.
  adminUrl: ""
};
