import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuidelinesController } from './guidelines.controller';
import { GuidelinesService } from './guidelines.service';
import { Guideline } from './guideline.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Guideline])],
  controllers: [GuidelinesController],
  providers: [GuidelinesService]
})
export class GuidelinesModule {}
