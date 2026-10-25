export type TRevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TRANSFER'
  | 'TEST';

export type TRevenueCatWebhookEvent = {
  api_version: string;
  event: {
    id: string;
    type: TRevenueCatEventType;
    app_user_id?: string;
    original_app_user_id?: string;
    aliases?: string[];
    product_id?: string;
    entitlement_id?: string | null;
    entitlement_ids?: string[] | null;
    purchased_at_ms?: number;
    expiration_at_ms?: number | null;
    environment: 'SANDBOX' | 'PRODUCTION';
    store: string;
    price?: number;
    currency?: string;
    price_in_purchased_currency?: number;
    cancel_reason?: string;
    transferred_to?: string[];
    transferred_from?: string[];
    transaction_id?: string;
    original_transaction_id?: string;
  };
};

export type TRevenueCatSyncPayload = {
  entitlement_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
};

export type TSubscriptionStatusResponse = {
  is_subscribed: boolean;
  subscription_name: string | null;
  subscription_expires_at: Date | null;
  days_remaining: number;
};
