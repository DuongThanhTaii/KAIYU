import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class VocabularyFoldersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all folders for a user
   */
  async findAllByUser(userId: string) {
    return this.prisma.vocabularyFolder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { vocabulary: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Create a new folder
   */
  async create(
    userId: string,
    data: { name: string; color?: string; icon?: string },
  ) {
    // Check if folder with same name exists
    const existing = await this.prisma.vocabularyFolder.findUnique({
      where: {
        userId_name: { userId, name: data.name },
      },
    });

    if (existing) {
      throw new Error('Folder with this name already exists');
    }

    return this.prisma.vocabularyFolder.create({
      data: {
        userId,
        name: data.name,
        color: data.color,
        icon: data.icon,
      },
    });
  }

  /**
   * Update a folder
   */
  async update(
    id: string,
    userId: string,
    data: { name?: string; color?: string; icon?: string },
  ) {
    // Verify ownership
    const folder = await this.prisma.vocabularyFolder.findFirst({
      where: { id, userId },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Check if new name conflicts with existing
    if (data.name && data.name !== folder.name) {
      const existing = await this.prisma.vocabularyFolder.findUnique({
        where: {
          userId_name: { userId, name: data.name },
        },
      });
      if (existing) {
        throw new Error('Folder with this name already exists');
      }
    }

    return this.prisma.vocabularyFolder.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a folder (vocabulary items are not deleted, just unassigned)
   */
  async delete(id: string, userId: string) {
    // Verify ownership
    const folder = await this.prisma.vocabularyFolder.findFirst({
      where: { id, userId },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    if (folder.isDefault) {
      throw new Error('Cannot delete default folder');
    }

    // Unassign vocabulary from this folder
    await this.prisma.userVocabulary.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });

    return this.prisma.vocabularyFolder.delete({
      where: { id },
    });
  }

  /**
   * Get or create default folder for user
   */
  async getOrCreateDefaultFolder(userId: string) {
    let defaultFolder = await this.prisma.vocabularyFolder.findFirst({
      where: { userId, isDefault: true },
    });

    if (!defaultFolder) {
      defaultFolder = await this.prisma.vocabularyFolder.create({
        data: {
          userId,
          name: 'Sổ từ vựng',
          isDefault: true,
          color: '#3B82F6',
          icon: 'book',
        },
      });
    }

    return defaultFolder;
  }

  /**
   * Get vocabulary in a specific folder
   */
  async getVocabularyByFolder(userId: string, folderId: string | null) {
    return this.prisma.userVocabulary.findMany({
      where: {
        userId,
        folderId: folderId,
      },
      include: {
        vocabulary: true,
        sourceVideo: {
          select: { id: true, title: true },
        },
      },
      orderBy: { savedAt: 'desc' },
    });
  }

  /**
   * Move vocabulary to a folder
   */
  async moveVocabularyToFolder(
    userId: string,
    userVocabularyId: string,
    folderId: string | null,
  ) {
    // Verify ownership of vocabulary
    const userVocab = await this.prisma.userVocabulary.findFirst({
      where: { id: userVocabularyId, userId },
    });

    if (!userVocab) {
      throw new Error('Vocabulary not found');
    }

    // If folderId provided, verify folder ownership
    if (folderId) {
      const folder = await this.prisma.vocabularyFolder.findFirst({
        where: { id: folderId, userId },
      });
      if (!folder) {
        throw new Error('Folder not found');
      }
    }

    return this.prisma.userVocabulary.update({
      where: { id: userVocabularyId },
      data: { folderId },
    });
  }
}
