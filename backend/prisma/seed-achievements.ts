import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default achievements that match the checkAndAwardAchievements() logic
const defaultAchievements = [
    // Vocabulary milestones
    {
        code: 'first_word',
        title: 'Từ Đầu Tiên',
        description: 'Học từ vựng đầu tiên của bạn',
        icon: 'menu_book',
        iconColor: 'text-green-400',
        xpReward: 10,
    },
    {
        code: 'vocab_10',
        title: 'Người Tập Sự',
        description: 'Học được 10 từ vựng',
        icon: 'school',
        iconColor: 'text-blue-400',
        xpReward: 50,
    },
    {
        code: 'vocab_50',
        title: 'Học Sinh Chăm Chỉ',
        description: 'Học được 50 từ vựng',
        icon: 'psychology',
        iconColor: 'text-purple-400',
        xpReward: 100,
    },
    {
        code: 'vocab_100',
        title: 'Bậc Thầy Từ Vựng',
        description: 'Học được 100 từ vựng',
        icon: 'diamond',
        iconColor: 'text-primary',
        xpReward: 200,
    },

    // Flashcard milestones
    {
        code: 'flashcard_10',
        title: 'Ôn Tập Viên',
        description: 'Ôn tập 10 flashcard',
        icon: 'style',
        iconColor: 'text-yellow-400',
        xpReward: 30,
    },
    {
        code: 'flashcard_100',
        title: 'Chuyên Gia Flashcard',
        description: 'Ôn tập 100 flashcard',
        icon: 'auto_awesome',
        iconColor: 'text-orange-400',
        xpReward: 150,
    },

    // Video milestones
    {
        code: 'video_first',
        title: 'Người Xem Đầu Tiên',
        description: 'Xem video đầu tiên',
        icon: 'play_circle',
        iconColor: 'text-blue-400',
        xpReward: 20,
    },
    {
        code: 'video_10',
        title: 'Fan Video',
        description: 'Xem 10 video',
        icon: 'video_library',
        iconColor: 'text-red-400',
        xpReward: 100,
    },

    // Streak milestones
    {
        code: 'streak_7',
        title: 'Tuần Lửa',
        description: 'Duy trì streak 7 ngày liên tiếp',
        icon: 'local_fire_department',
        iconColor: 'text-orange-400',
        xpReward: 100,
    },
    {
        code: 'streak_30',
        title: 'Tháng Cháy',
        description: 'Duy trì streak 30 ngày liên tiếp',
        icon: 'rocket_launch',
        iconColor: 'text-red-400',
        xpReward: 500,
    },
];

async function main() {
    console.log('🏆 Seeding achievements...');

    for (const achievement of defaultAchievements) {
        const existing = await prisma.achievement.findUnique({
            where: { code: achievement.code },
        });

        if (existing) {
            // Update existing achievement
            await prisma.achievement.update({
                where: { code: achievement.code },
                data: {
                    title: achievement.title,
                    description: achievement.description,
                    icon: achievement.icon,
                    iconColor: achievement.iconColor,
                    xpReward: achievement.xpReward,
                },
            });
            console.log(`  ✅ Updated: ${achievement.code}`);
        } else {
            // Create new achievement
            await prisma.achievement.create({
                data: achievement,
            });
            console.log(`  ➕ Created: ${achievement.code}`);
        }
    }

    console.log(`\n✨ Done! ${defaultAchievements.length} achievements seeded.`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding achievements:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
