import { Module, Global } from '@nestjs/common';
import { XpStreakService } from './xp-streak.service';

@Global()
@Module({
  providers: [XpStreakService],
  exports: [XpStreakService],
})
export class XpStreakModule {}
