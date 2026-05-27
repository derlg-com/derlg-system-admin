import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  private webhookRequestsTotal: client.Counter;
  private commandUsageTotal: client.Counter;
  private assignmentActionsTotal: client.Counter;
  private broadcastMessagesTotal: client.Counter;
  private botResponseTimeSeconds: client.Histogram;
  private botUptimeSeconds: client.Gauge;
  private botStartTime: number;

  onModuleInit() {
    try {
      client.collectDefaultMetrics();
    } catch {
      // Default metrics may already be registered in test environments
    }
    this.botStartTime = Date.now();

    this.webhookRequestsTotal = new client.Counter({
      name: 'telegram_webhook_requests_total',
      help: 'Total number of Telegram webhook requests received',
      labelNames: ['status', 'update_type'],
    });

    this.commandUsageTotal = new client.Counter({
      name: 'telegram_command_usage_total',
      help: 'Total number of bot commands used by drivers',
      labelNames: ['command'],
    });

    this.assignmentActionsTotal = new client.Counter({
      name: 'telegram_assignment_actions_total',
      help: 'Total number of assignment actions (accept/reject/complete/start)',
      labelNames: ['action', 'status'],
    });

    this.broadcastMessagesTotal = new client.Counter({
      name: 'telegram_broadcast_messages_total',
      help: 'Total number of broadcast messages sent',
      labelNames: ['status'],
    });

    this.botResponseTimeSeconds = new client.Histogram({
      name: 'telegram_bot_response_time_seconds',
      help: 'Response time of bot webhook handler in seconds',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    });

    this.botUptimeSeconds = new client.Gauge({
      name: 'telegram_bot_uptime_seconds',
      help: 'Bot uptime in seconds',
      collect: () => {
        this.botUptimeSeconds.set((Date.now() - this.botStartTime) / 1000);
      },
    });

    this.logger.log('Prometheus metrics initialized');
  }

  recordWebhookRequest(status: 'success' | 'error' | 'rate_limited' | 'duplicate', updateType: string) {
    this.webhookRequestsTotal.inc({ status, update_type: updateType });
  }

  recordCommandUsage(command: string) {
    this.commandUsageTotal.inc({ command });
  }

  recordAssignmentAction(action: 'accept' | 'reject' | 'start' | 'complete', status: 'success' | 'error') {
    this.assignmentActionsTotal.inc({ action, status });
  }

  recordBroadcastMessage(status: 'sent' | 'failed') {
    this.broadcastMessagesTotal.inc({ status });
  }

  recordResponseTime(seconds: number) {
    this.botResponseTimeSeconds.observe(seconds);
  }

  getMetrics(): Promise<string> {
    return client.register.metrics();
  }

  getContentType(): string {
    return client.register.contentType;
  }
}
