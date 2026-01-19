import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const achievements = [
    {
        code: 'first_word',
        title: 'Từ đầu tiên',
        description: 'Lưu từ vựng đầu tiên vào sổ',
        icon: 'bookmark',
        iconColor: 'text-blue-400',
        xpReward: 10,
    },
    {
        code: 'vocab_10',
        title: 'Bộ sưu tập nhỏ',
        description: 'Lưu 10 từ vựng',
        icon: 'collections_bookmark',
        iconColor: 'text-blue-400',
        xpReward: 25,
    },
    {
        code: 'vocab_50',
        title: 'Người sưu tầm',
        description: 'Lưu 50 từ vựng',
        icon: 'library_books',
        iconColor: 'text-purple-400',
        xpReward: 100,
    },
    {
        code: 'vocab_100',
        title: 'Học giả',
        description: 'Lưu 100 từ vựng',
        icon: 'school',
        iconColor: 'text-purple-400',
        xpReward: 250,
    },
    {
        code: 'flashcard_10',
        title: 'Bắt đầu ôn tập',
        description: 'Hoàn thành 10 lượt ôn tập flashcard',
        icon: 'style',
        iconColor: 'text-orange-400',
        xpReward: 20,
    },
    {
        code: 'flashcard_100',
        title: 'Ôn tập chăm chỉ',
        description: 'Hoàn thành 100 lượt ôn tập flashcard',
        icon: 'psychology',
        iconColor: 'text-orange-400',
        xpReward: 150,
    },
    {
        code: 'video_first',
        title: 'Người xem mới',
        description: 'Xem hết video đầu tiên',
        icon: 'play_circle',
        iconColor: 'text-green-400',
        xpReward: 15,
    },
    {
        code: 'video_10',
        title: 'Nghiện video',
        description: 'Xem hết 10 video',
        icon: 'movie',
        iconColor: 'text-green-400',
        xpReward: 100,
    },
    {
        code: 'streak_7',
        title: 'Tuần đầu tiên',
        description: 'Duy trì streak 7 ngày',
        icon: 'local_fire_department',
        iconColor: 'text-red-400',
        xpReward: 75,
    },
    {
        code: 'streak_30',
        title: 'Tháng kiên trì',
        description: 'Duy trì streak 30 ngày',
        icon: 'whatshot',
        iconColor: 'text-red-400',
        xpReward: 500,
    },
];

async function main() {
    console.log('🌱 Seeding achievements...');

    for (const achievement of achievements) {
        await prisma.achievement.upsert({
            where: { code: achievement.code },
            update: achievement,
            create: achievement,
        });
        console.log(`  ✓ ${achievement.title}`);
    }

    console.log(`\n✅ Seeded ${achievements.length} achievements`);

    // Create or update admin user
    console.log('\n👤 Ensuring admin user exists...');
    const bcrypt = await import('bcrypt');
    const adminEmail = 'admin@test.com';
    const adminPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const adminUser = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: 'admin', passwordHash: hashedPassword },
        create: {
            email: adminEmail,
            name: 'Admin User',
            passwordHash: hashedPassword,
            role: 'admin',
            hskLevel: 1,
        },
    });

    console.log(`  ✓ Admin user: ${adminUser.email} (role: ${adminUser.role})`);
    console.log(`  📝 Password: ${adminPassword}`);
}

main()
    .catch((e) => {
        console.error('Error seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        pool.end();
    });
