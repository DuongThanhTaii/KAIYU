'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import Badge from '@/components/common/Badge';
import ScenePlayer from '@/components/common/ScenePlayer';
import { scenesApi, type SceneTemplate, type DialogFlow } from '@/services/scenesApi';
import { useAuth } from '@/contexts/AuthContext';

// Demo templates for when API is not available
const demoTemplates: SceneTemplate[] = [
    {
        id: 'demo-coffee',
        name: 'Coffee Shop',
        nameVi: 'Quán Cà Phê',
        description: 'Order a drink at a coffee shop',
        category: 'daily_life',
        hskLevel: 2,
        imageUrl: null,
        vocabSlots: ['drink'],
        difficulty: 'easy',
        usageCount: 0,
        dialogFlow: {
            start: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '你好！欢迎光临！想喝点什么？',
                textVi: 'Xin chào! Chào mừng quý khách! Bạn muốn uống gì?',
                pinyin: 'Nǐ hǎo! Huānyíng guānglín! Xiǎng hē diǎn shénme?',
                choices: [
                    { id: 'a', text: '我要一杯咖啡。', textVi: 'Cho tôi một ly cà phê.', next: 'hot_cold', correct: true },
                    { id: 'b', text: '你们有什么推荐？', textVi: 'Các bạn có gì giới thiệu không?', next: 'recommend' },
                    { id: 'c', text: '多少钱？', textVi: 'Bao nhiêu tiền?', next: 'price_first' }
                ]
            },
            hot_cold: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '好的！热的还是冰的？',
                textVi: 'Được! Nóng hay đá?',
                pinyin: 'Hǎo de! Rè de háishì bīng de?',
                choices: [
                    { id: 'a', text: '冰的。', textVi: 'Đá.', next: 'size', correct: true },
                    { id: 'b', text: '热的。', textVi: 'Nóng.', next: 'size' }
                ]
            },
            size: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '大杯还是小杯？',
                textVi: 'Ly lớn hay ly nhỏ?',
                pinyin: 'Dà bēi háishì xiǎo bēi?',
                choices: [
                    { id: 'a', text: '大杯。', textVi: 'Ly lớn.', next: 'payment', correct: true },
                    { id: 'b', text: '小杯。', textVi: 'Ly nhỏ.', next: 'payment' }
                ]
            },
            recommend: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '我们的拿铁很受欢迎！',
                textVi: 'Latte của chúng tôi rất được yêu thích!',
                pinyin: 'Wǒmen de ná tiě hěn shòu huānyíng!',
                choices: [
                    { id: 'a', text: '好，我要一杯拿铁。', textVi: 'Được, cho tôi một ly latte.', next: 'hot_cold' }
                ]
            },
            price_first: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '咖啡二十块，奶茶十五块。',
                textVi: 'Cà phê 20 tệ, trà sữa 15 tệ.',
                pinyin: 'Kāfēi èrshí kuài, nǎichá shíwǔ kuài.',
                choices: [
                    { id: 'a', text: '我要咖啡。', textVi: 'Cho tôi cà phê.', next: 'hot_cold' }
                ]
            },
            payment: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '一共二十块。微信还是支付宝？',
                textVi: 'Tổng cộng 20 tệ. WeChat hay Alipay?',
                pinyin: 'Yīgòng èrshí kuài. Wēixìn háishì Zhīfùbǎo?',
                choices: [
                    { id: 'a', text: '微信。', textVi: 'WeChat.', next: 'end_success' },
                    { id: 'b', text: '支付宝。', textVi: 'Alipay.', next: 'end_success' }
                ]
            },
            end_success: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '好的，请稍等！谢谢！',
                textVi: 'Được, xin đợi một chút! Cảm ơn!',
                pinyin: 'Hǎo de, qǐng shāo děng! Xièxiè!',
                isEnd: true,
                score: 100
            }
        }
    },
    {
        id: 'demo-taxi',
        name: 'Taxi Ride',
        nameVi: 'Đi Taxi',
        description: 'Take a taxi in China',
        category: 'travel',
        hskLevel: 2,
        imageUrl: null,
        vocabSlots: ['place'],
        difficulty: 'easy',
        usageCount: 0,
        dialogFlow: {
            start: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '你好！去哪儿？',
                textVi: 'Xin chào! Đi đâu?',
                pinyin: 'Nǐ hǎo! Qù nǎr?',
                choices: [
                    { id: 'a', text: '去机场。', textVi: 'Đến sân bay.', next: 'confirm', correct: true },
                    { id: 'b', text: '去火车站。', textVi: 'Đến ga tàu.', next: 'confirm' }
                ]
            },
            confirm: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '好的！系好安全带。大概二十分钟。',
                textVi: 'Được! Thắt dây an toàn. Khoảng 20 phút.',
                pinyin: 'Hǎo de! Jì hǎo ānquándài. Dàgài èrshí fēnzhōng.',
                choices: [
                    { id: 'a', text: '好的，谢谢！', textVi: 'Được, cảm ơn!', next: 'arrive' }
                ]
            },
            arrive: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '到了！一共三十五块。',
                textVi: 'Đến rồi! Tổng cộng 35 tệ.',
                pinyin: 'Dào le! Yīgòng sānshíwǔ kuài.',
                choices: [
                    { id: 'a', text: '微信付款。谢谢！', textVi: 'Thanh toán WeChat. Cảm ơn!', next: 'end_success' }
                ]
            },
            end_success: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '谢谢！再见！',
                textVi: 'Cảm ơn! Tạm biệt!',
                pinyin: 'Xièxiè! Zàijiàn!',
                isEnd: true,
                score: 100
            }
        }
    },
    {
        id: 'demo-restaurant',
        name: 'Restaurant',
        nameVi: 'Nhà Hàng',
        description: 'Order food at a restaurant',
        category: 'daily_life',
        hskLevel: 2,
        imageUrl: null,
        vocabSlots: ['food'],
        difficulty: 'easy',
        usageCount: 0,
        dialogFlow: {
            start: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '欢迎光临！几位？',
                textVi: 'Chào mừng! Mấy người?',
                pinyin: 'Huānyíng guānglín! Jǐ wèi?',
                choices: [
                    { id: 'a', text: '两位。', textVi: 'Hai người.', next: 'menu', correct: true },
                    { id: 'b', text: '一个人。', textVi: 'Một mình.', next: 'menu' }
                ]
            },
            menu: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '请坐！这是菜单。要点什么？',
                textVi: 'Mời ngồi! Đây là thực đơn. Gọi gì ạ?',
                pinyin: 'Qǐng zuò! Zhè shì càidān. Yào diǎn shénme?',
                choices: [
                    { id: 'a', text: '我要宫保鸡丁和米饭。', textVi: 'Cho tôi gà Kung Pao và cơm.', next: 'drink', correct: true },
                    { id: 'b', text: '有什么推荐？', textVi: 'Có gì giới thiệu?', next: 'recommend' }
                ]
            },
            recommend: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '宫保鸡丁很好吃！',
                textVi: 'Gà Kung Pao rất ngon!',
                pinyin: 'Gōngbǎo jīdīng hěn hǎochī!',
                choices: [
                    { id: 'a', text: '好，我要这个。', textVi: 'Được, cho tôi món này.', next: 'drink' }
                ]
            },
            drink: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '要喝什么？',
                textVi: 'Uống gì?',
                pinyin: 'Yào hē shénme?',
                choices: [
                    { id: 'a', text: '一杯可乐。', textVi: 'Một ly cola.', next: 'end_success' },
                    { id: 'b', text: '白开水就好。', textVi: 'Nước lọc thôi.', next: 'end_success' }
                ]
            },
            end_success: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '好的，请稍等！',
                textVi: 'Được, xin đợi một chút!',
                pinyin: 'Hǎo de, qǐng shāo děng!',
                isEnd: true,
                score: 100
            }
        }
    }
];

const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'daily_life': return 'coffee';
        case 'travel': return 'flight';
        case 'business': return 'work';
        case 'shopping': return 'shopping_cart';
        default: return 'theater_comedy';
    }
};

const getCategoryColor = (category: string) => {
    switch (category) {
        case 'daily_life': return 'bg-blue-500/20 text-blue-400';
        case 'travel': return 'bg-green-500/20 text-green-400';
        case 'business': return 'bg-purple-500/20 text-purple-400';
        case 'shopping': return 'bg-orange-500/20 text-orange-400';
        default: return 'bg-primary/20 text-primary';
    }
};

export default function ScenesPage() {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<SceneTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Load templates
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                setIsLoading(true);
                const data = await scenesApi.getTemplates(user?.hskLevel);
                setTemplates(data.length > 0 ? data : demoTemplates);
            } catch (err) {
                console.warn('Failed to load templates from API, using demo:', err);
                setTemplates(demoTemplates);
            } finally {
                setIsLoading(false);
            }
        };

        loadTemplates();
    }, [user?.hskLevel]);

    // Handle play scene
    const handlePlayScene = useCallback((template: SceneTemplate) => {
        setSelectedTemplate(template);
        setIsPlaying(true);
    }, []);

    // Handle scene complete
    const handleSceneComplete = useCallback(async (score: number, choices: string[]) => {
        if (selectedTemplate && user) {
            try {
                await scenesApi.saveHistory({
                    templateId: selectedTemplate.id,
                    score,
                    choicesMade: { choices },
                    vocabUsed: [],
                });
            } catch (err) {
                console.error('Failed to save history:', err);
            }
        }
        setIsPlaying(false);
        setSelectedTemplate(null);
    }, [selectedTemplate, user]);

    // Handle close
    const handleClose = useCallback(() => {
        setIsPlaying(false);
        setSelectedTemplate(null);
    }, []);

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Icon name="theater_comedy" className="text-primary" />
                        Luyện Tình Huống
                    </h1>
                    <p className="text-text-secondary mt-2">
                        Thực hành hội thoại trong các tình huống thực tế
                    </p>
                </div>

                {/* Scene Player Modal */}
                {isPlaying && selectedTemplate && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-lg flex items-center justify-center p-4">
                        <ScenePlayer
                            sceneName={selectedTemplate.name}
                            sceneNameVi={selectedTemplate.nameVi}
                            dialogFlow={selectedTemplate.dialogFlow}
                            onComplete={handleSceneComplete}
                            onClose={handleClose}
                        />
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <Icon name="sync" className="animate-spin text-4xl text-primary" />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <Card variant="default" className="bg-red-500/10 border-red-500/30">
                        <p className="text-red-400">{error}</p>
                    </Card>
                )}

                {/* Templates Grid */}
                {!isLoading && templates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((template) => (
                            <Card
                                key={template.id}
                                variant="default"
                                padding="none"
                                className="overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer"
                                onClick={() => handlePlayScene(template)}
                            >
                                {/* Image/Placeholder */}
                                <div className="h-32 bg-gradient-to-br from-primary/20 to-surface-highlight flex items-center justify-center">
                                    <div className={`size-16 rounded-full ${getCategoryColor(template.category)} flex items-center justify-center`}>
                                        <Icon name={getCategoryIcon(template.category)} className="text-3xl" />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                                                {template.name}
                                            </h3>
                                            <p className="text-text-secondary text-sm">{template.nameVi}</p>
                                        </div>
                                        <Badge variant="hsk" hskLevel={template.hskLevel}>
                                            HSK {template.hskLevel}
                                        </Badge>
                                    </div>

                                    {template.description && (
                                        <p className="text-text-secondary text-sm mb-3 line-clamp-2">
                                            {template.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${template.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                                            template.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                            {template.difficulty === 'easy' ? 'Dễ' :
                                                template.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                                        </span>

                                        <Button
                                            variant="primary"
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Icon name="play_arrow" size="sm" className="mr-1" />
                                            Bắt đầu
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && templates.length === 0 && (
                    <Card variant="default" className="text-center py-12">
                        <Icon name="theater_comedy" className="text-6xl text-text-secondary mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Chưa có tình huống nào</h3>
                        <p className="text-text-secondary">
                            Các tình huống luyện tập sẽ sớm được thêm vào.
                        </p>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
