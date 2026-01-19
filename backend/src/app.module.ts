import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { VideosModule } from './videos';
import { VocabularyModule } from './vocabulary';
import { UserVocabularyModule } from './user-vocabulary';
import { FlashcardsModule } from './flashcards';
import { ProgressModule } from './progress';
import { AdminModule } from './admin';
import { UploadModule } from './upload/upload.module';
import { AchievementsModule } from './achievements';
import { LearningGoalsModule } from './learning-goals';
import { QuizzesModule } from './quizzes';
import { DictionaryModule } from './dictionary';
import { VocabularyFoldersModule } from './vocabulary-folders';
import { VideoNotesModule } from './video-notes';
import { SavedVideosModule } from './saved-videos/saved-videos.module';
import { XpStreakModule } from './xp-streak/xp-streak.module';
import { ScenesModule } from './scenes/scenes.module';
import { EmailModule } from './email/email.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Database
    PrismaModule,

    // Global services
    XpStreakModule,
    CloudinaryModule,

    // Feature modules
    AuthModule,
    VideosModule,
    VocabularyModule,
    UserVocabularyModule,
    FlashcardsModule,
    ProgressModule,
    AdminModule,
    UploadModule,
    AchievementsModule,
    LearningGoalsModule,
    QuizzesModule,
    DictionaryModule,
    VocabularyFoldersModule,
    VideoNotesModule,
    SavedVideosModule,
    ScenesModule,
    EmailModule,
    SchedulerModule,
    SettingsModule,
  ],
})
export class AppModule { }

