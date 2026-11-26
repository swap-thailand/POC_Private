// Errors carry an i18n key so screens can show a translated message.
export class ServiceError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
  }
}

// Error codes → i18n keys
export const errorKeys = {
  notConnected: 'notConnected',
  notSignedIn: 'signIn',
  forbidden: 'adminOnly',
  banned: 'bannedMsg',
  priceTooHigh: 'tooHigh',
  fileError: 'fileError',
  unavailable: 'unavailableMsg',
  consent: 'needConsent',
  invalid: 'error',
  reasonRequired: 'reasonRequired',
  ownListing: 'ownListingApprove',
  priceInvalid: 'wholeBaht',
  partnerFields: 'pt_needFields',
  cardDeclined: 'cardDeclined',
  sampleOnly: 'exOnly',
};
