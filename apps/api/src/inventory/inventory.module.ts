import { Module } from '@nestjs/common';
import { DevicesModule } from './devices/devices.module.js';
import { FlagsModule } from './flags/flags.module.js';
import { EventsModule } from './events/events.module.js';

@Module({
  imports: [DevicesModule, FlagsModule, EventsModule]
})
export class InventoryModule {}
