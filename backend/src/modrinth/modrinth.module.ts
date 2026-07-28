import { Module } from '@nestjs/common';
import { ModrinthController } from './modrinth.controller';
import { ModrinthService } from './modrinth.service';
import { ServerManagementModule } from '../server-management/server-management.module';

@Module({
  imports: [ServerManagementModule],
  controllers: [ModrinthController],
  providers: [ModrinthService],
  exports: [ModrinthService],
})
export class ModrinthModule {}
