import api from './api';

export interface EmailTemplate {
    id: string;
    code: string;
    name: string;
    nameVi: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    designJson?: any;
    variables: string[];
    category: string;
    isActive: boolean;
    // Trigger configuration
    triggerType: string; // 'inactive_days' | 'daily' | 'weekly' | 'manual'
    triggerDays: number;
    triggerHour: number;
    triggerDayOfWeek?: number;
    createdAt: string;
    updatedAt: string;
}

export interface EmailLog {
    id: string;
    userId: string;
    templateId: string;
    toEmail: string;
    subject: string;
    status: string;
    sentAt?: string;
    openedAt?: string;
    clickedAt?: string;
    errorMessage?: string;
    createdAt: string;
    user?: { name: string; email: string };
    template?: { code: string; name: string };
}

export interface UserEmailSettings {
    id: string;
    enableReminders: boolean;
    enableWeeklyReport: boolean;
    enableEngagement: boolean;
    reminderHour: number;
    timezone: string;
}

export interface EmailStatistics {
    summary: {
        totalSent: number;
        totalOpened: number;
        totalClicked: number;
        totalFailed: number;
        openRate: number;
        clickRate: number;
    };
    templateStats: Array<{
        templateId: string;
        templateName: string;
        templateCode: string;
        count: number;
    }>;
    dailyStats: Array<{
        date: string;
        sent: number;
        opened: number;
    }>;
}

// ==================== USER API ====================

export const getUserEmailSettings = async (): Promise<UserEmailSettings> => {
    const response = await api.get('/email/settings');
    return response.data;
};

export const updateUserEmailSettings = async (data: Partial<UserEmailSettings>): Promise<UserEmailSettings> => {
    const response = await api.put('/email/settings', data);
    return response.data;
};

// ==================== ADMIN API ====================

export const getEmailTemplates = async (): Promise<EmailTemplate[]> => {
    const response = await api.get('/email/admin/templates');
    return response.data;
};

export const upsertEmailTemplate = async (template: Partial<EmailTemplate>): Promise<EmailTemplate> => {
    const response = await api.post('/email/admin/templates', template);
    return response.data;
};

export const deleteEmailTemplate = async (code: string): Promise<void> => {
    await api.delete(`/email/admin/templates/${code}`);
};

export const getEmailLogs = async (params?: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
}): Promise<{ data: EmailLog[]; total: number }> => {
    const response = await api.get('/email/admin/logs', { params });
    return response.data;
};

export const seedEmailTemplates = async (): Promise<{ message: string }> => {
    const response = await api.post('/email/admin/templates/seed');
    return response.data;
};

export const testSendEmail = async (templateCode: string, variables?: Record<string, string | number>): Promise<any> => {
    const response = await api.post('/email/admin/test-send', { templateCode, variables });
    return response.data;
};

export const getEmailStatistics = async (): Promise<EmailStatistics> => {
    const response = await api.get('/email/admin/statistics');
    return response.data;
};

export const previewEmailTemplate = async (subject: string, htmlBody: string): Promise<{
    subject: string;
    html: string;
    sampleData: Record<string, string | number>;
}> => {
    const response = await api.post('/email/admin/preview', { subject, htmlBody });
    return response.data;
};

export const broadcastEmail = async (subject: string, htmlBody: string, targetUsers: 'all' | 'active' = 'active'): Promise<{
    totalUsers: number;
    sentCount: number;
    failedCount: number;
}> => {
    const response = await api.post('/email/admin/broadcast', { subject, htmlBody, targetUsers });
    return response.data;
};

// ==================== SETTINGS API ====================

export const getLogoUrl = async (): Promise<{ url: string | null }> => {
    const response = await api.get('/settings/logo');
    return response.data;
};

export const uploadLogo = async (file: File): Promise<{ url: string; width: number; height: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/settings/admin/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const deleteLogo = async (): Promise<void> => {
    await api.delete('/settings/admin/logo');
};

export const getPublicSettings = async (): Promise<{ logo: string | null; siteName: string }> => {
    const response = await api.get('/settings/public');
    return response.data;
};
