import { Module, Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }
}

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MonitoringModule {}
