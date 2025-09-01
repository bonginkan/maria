/**
 * Notification Port
 * Defines the contract for notification and messaging operations
 */

export interface NotificationMessage {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
  userId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  scheduledAt?: Date;
  expiresAt?: Date;
}

export interface NotificationChannel {
  id: string;
  type: "email" | "sms" | "push" | "webhook" | "slack" | "teams" | "discord";
  name: string;
  configuration: Record<string, any>;
  isEnabled: boolean;
  userId?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  template: {
    title: string;
    body: string;
    variables: string[];
  };
  channels: string[];
}

export interface NotificationDelivery {
  id: string;
  messageId: string;
  channelId: string;
  status: "pending" | "sent" | "delivered" | "failed" | "expired";
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  error?: string;
}

export interface NotificationStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  messagesByType: Record<string, number>;
  messagesByChannel: Record<string, number>;
}

/**
 * Primary port for notification operations
 */
export interface INotificationPort {
  /**
   * Send a notification message
   */
  sendNotification(
    message: Omit<NotificationMessage, "id" | "createdAt">,
    channels: string[],
  ): Promise<NotificationMessage>;

  /**
   * Send notification using template
   */
  sendFromTemplate(
    templateId: string,
    variables: Record<string, any>,
    userId?: string,
    channels?: string[],
  ): Promise<NotificationMessage>;

  /**
   * Schedule a notification
   */
  scheduleNotification(
    message: Omit<NotificationMessage, "id" | "createdAt">,
    channels: string[],
    scheduleTime: Date,
  ): Promise<NotificationMessage>;

  /**
   * Cancel scheduled notification
   */
  cancelNotification(messageId: string): Promise<boolean>;

  /**
   * Get notification by ID
   */
  getNotification(messageId: string): Promise<NotificationMessage | null>;

  /**
   * Get notifications for user
   */
  getNotifications(
    userId: string,
    options?: {
      type?: string;
      status?: string;
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<NotificationMessage[]>;

  /**
   * Mark notification as read
   */
  markAsRead(_messageId: string, userId: string): Promise<boolean>;

  /**
   * Register notification channel
   */
  registerChannel(
    _channel: Omit<NotificationChannel, "id">,
  ): Promise<NotificationChannel>;

  /**
   * Update notification channel
   */
  updateChannel(
    _channelId: string,
    updates: Partial<NotificationChannel>,
  ): Promise<NotificationChannel | null>;

  /**
   * Remove notification channel
   */
  removeChannel(channelId: string): Promise<boolean>;

  /**
   * Get channels for user
   */
  getChannels(userId?: string): Promise<NotificationChannel[]>;

  /**
   * Test notification channel
   */
  testChannel(channelId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Create notification template
   */
  createTemplate(
    _template: Omit<NotificationTemplate, "id">,
  ): Promise<NotificationTemplate>;

  /**
   * Update notification template
   */
  updateTemplate(
    _templateId: string,
    updates: Partial<NotificationTemplate>,
  ): Promise<NotificationTemplate | null>;

  /**
   * Remove notification template
   */
  removeTemplate(templateId: string): Promise<boolean>;

  /**
   * Get notification templates
   */
  getTemplates(type?: string): Promise<NotificationTemplate[]>;

  /**
   * Get delivery status for message
   */
  getDeliveryStatus(messageId: string): Promise<NotificationDelivery[]>;

  /**
   * Retry failed notification
   */
  retryNotification(_messageId: string, channelId?: string): Promise<boolean>;

  /**
   * Get notification statistics
   */
  getStats(options?: {
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
    channels?: string[];
    types?: string[];
  }): Promise<NotificationStats>;

  /**
   * Bulk send notifications
   */
  bulkSend(
    messages: Array<{
      message: Omit<NotificationMessage, "id" | "createdAt">;
      channels: string[];
    }>,
  ): Promise<NotificationMessage[]>;

  /**
   * Subscribe to notification events
   */
  subscribe(
    eventTypes: string[],
    callback: (event: {
      type: string;
      messageId: string;
      channelId?: string;
      status?: string;
      error?: string;
      timestamp: Date;
    }) => void,
  ): Promise<string>;

  /**
   * Unsubscribe from notification events
   */
  unsubscribe(subscriptionId: string): Promise<boolean>;

  /**
   * Health check
   */
  healthCheck(): Promise<{ isHealthy: boolean; details?: Record<string, any> }>;
}
