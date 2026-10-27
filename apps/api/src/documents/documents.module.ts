import { Module } from '@nestjs/common';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { EvidencePacksModule } from './evidence-packs/evidence-packs.module.js';

@Module({
  imports: [ReceiptsModule, UploadsModule, EvidencePacksModule]
})
export class DocumentsModule {}
