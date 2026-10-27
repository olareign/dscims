import { Global, Module } from '@nestjs/common';
import { DeviceEventsService } from './device-events.service.js';

@Global()
@Module({ providers: [DeviceEventsService], exports: [DeviceEventsService] })
export class EventsModule {}
