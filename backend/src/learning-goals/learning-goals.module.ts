import { Module } from '@nestjs/common';
import { LearningGoalsController } from './learning-goals.controller';
import { LearningGoalsService } from './learning-goals.service';
import { PrismaModule } from '../prisma';

@Module({
    imports: [PrismaModule],
    controllers: [LearningGoalsController],
    providers: [LearningGoalsService],
    exports: [LearningGoalsService],
})
export class LearningGoalsModule { }
