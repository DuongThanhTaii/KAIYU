import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VideoNotesService {
    constructor(private prisma: PrismaService) { }

    async findByVideoId(userId: string, videoId: string) {
        const notes = await this.prisma.videoNote.findMany({
            where: {
                userId,
                videoId,
            },
            orderBy: { timestampSec: 'asc' },
        });

        return notes.map(note => ({
            ...note,
            timestampSec: Number(note.timestampSec),
        }));
    }

    async create(userId: string, data: {
        videoId: string;
        timestampSec: number;
        content: string;
    }) {
        // Verify video exists
        const video = await this.prisma.video.findUnique({
            where: { id: data.videoId },
        });

        if (!video) {
            throw new NotFoundException('Video not found');
        }

        const note = await this.prisma.videoNote.create({
            data: {
                userId,
                videoId: data.videoId,
                timestampSec: data.timestampSec,
                content: data.content,
            },
        });

        return {
            ...note,
            timestampSec: Number(note.timestampSec),
        };
    }

    async update(userId: string, noteId: string, data: {
        content?: string;
        timestampSec?: number;
    }) {
        const note = await this.prisma.videoNote.findUnique({
            where: { id: noteId },
        });

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        if (note.userId !== userId) {
            throw new ForbiddenException('Not authorized to update this note');
        }

        const updateData: any = {};
        if (data.content !== undefined) updateData.content = data.content;
        if (data.timestampSec !== undefined) updateData.timestampSec = data.timestampSec;

        const updated = await this.prisma.videoNote.update({
            where: { id: noteId },
            data: updateData,
        });

        return {
            ...updated,
            timestampSec: Number(updated.timestampSec),
        };
    }

    async remove(userId: string, noteId: string) {
        const note = await this.prisma.videoNote.findUnique({
            where: { id: noteId },
        });

        if (!note) {
            throw new NotFoundException('Note not found');
        }

        if (note.userId !== userId) {
            throw new ForbiddenException('Not authorized to delete this note');
        }

        await this.prisma.videoNote.delete({
            where: { id: noteId },
        });

        return { message: 'Note deleted successfully' };
    }
}
