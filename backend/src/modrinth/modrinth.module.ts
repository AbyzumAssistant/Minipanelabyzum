import { Module } from '@nestjs/common';
import { ModrinthController } from './modrinth.controller';
import { ModrinthService } from './modrinth.service';
import { ServerManagementModule } from '../server-management/server-management.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [ServerManagementModule, FilesModule],
  controllers: [ModrinthController],
  providers: [ModrinthService],
  exports: [ModrinthService],
})
export class ModrinthModule {}
