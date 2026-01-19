import React from 'react';
import Link from 'next/link';
import LandingNavbar from '@/components/layout/LandingNavbar';
import Footer from '@/components/layout/Footer';
import Icon from '@/components/common/Icon';
import Card from '@/components/common/Card';

export default function ContactPage() {
    return (
        <div className="bg-background-dark text-white font-display min-h-screen">
            <LandingNavbar />

            <div className="max-w-4xl mx-auto px-4 pt-32 pb-20">
                {/* Back Link */}
                <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
                    <Icon name="arrow_back" size="sm" />
                    Quay lại trang chủ
                </Link>

                <h1 className="text-4xl font-black mb-4">Liên Hệ</h1>
                <p className="text-text-secondary mb-12 text-lg">
                    Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn. Hãy liên hệ với chúng tôi qua các kênh dưới đây.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {/* Email Card */}
                    <Card variant="default" padding="lg" className="text-center">
                        <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="email" className="text-primary text-3xl" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Email</h3>
                        <p className="text-text-secondary mb-4">Gửi email cho chúng tôi, phản hồi trong 24 giờ</p>
                        <a href="mailto:contact@KAIYU.vn" className="text-primary hover:underline font-bold text-lg">
                            contact@KAIYU.vn
                        </a>
                    </Card>

                    {/* Phone Card */}
                    <Card variant="default" padding="lg" className="text-center">
                        <div className="size-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="phone" className="text-blue-400 text-3xl" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Điện thoại</h3>
                        <p className="text-text-secondary mb-4">Hotline hỗ trợ: Thứ 2 - Thứ 6, 9:00 - 18:00</p>
                        <a href="tel:+84123456789" className="text-blue-400 hover:underline font-bold text-lg">
                            (+84) 123 456 789
                        </a>
                    </Card>

                    {/* Address Card */}
                    <Card variant="default" padding="lg" className="text-center">
                        <div className="size-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="location_on" className="text-orange-400 text-3xl" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Địa chỉ</h3>
                        <p className="text-text-secondary mb-4">Văn phòng chính</p>
                        <p className="text-gray-300">
                            123 Đường ABC, Quận XYZ<br />
                            TP. Hồ Chí Minh, Việt Nam
                        </p>
                    </Card>

                    {/* Social Media Card */}
                    <Card variant="default" padding="lg" className="text-center">
                        <div className="size-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="share" className="text-purple-400 text-3xl" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Mạng xã hội</h3>
                        <p className="text-text-secondary mb-4">Theo dõi chúng tôi để cập nhật mới nhất</p>
                        <div className="flex justify-center gap-4">
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                                className="size-10 bg-surface-highlight rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                                <span className="text-xl">📘</span>
                            </a>
                            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
                                className="size-10 bg-surface-highlight rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                                <span className="text-xl">▶️</span>
                            </a>
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                                className="size-10 bg-surface-highlight rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors">
                                <span className="text-xl">📷</span>
                            </a>
                            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer"
                                className="size-10 bg-surface-highlight rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors">
                                <span className="text-xl">🎵</span>
                            </a>
                        </div>
                    </Card>
                </div>

                {/* Contact Form */}
                <Card variant="elevated" padding="lg" className="mb-12">
                    <h2 className="text-2xl font-bold mb-6">Gửi tin nhắn cho chúng tôi</h2>
                    <form className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Họ và tên <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                    placeholder="Nguyễn Văn A"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Email <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Chủ đề
                            </label>
                            <select className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white focus:outline-none focus:border-primary transition-colors">
                                <option value="">Chọn chủ đề...</option>
                                <option value="support">Hỗ trợ kỹ thuật</option>
                                <option value="billing">Thanh toán & Tài khoản</option>
                                <option value="feedback">Góp ý & Phản hồi</option>
                                <option value="partnership">Hợp tác kinh doanh</option>
                                <option value="other">Khác</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Nội dung <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                required
                                rows={5}
                                className="w-full px-4 py-3 bg-background-dark border border-border-color rounded-xl text-white placeholder-text-secondary focus:outline-none focus:border-primary transition-colors resize-none"
                                placeholder="Nhập nội dung tin nhắn..."
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full md:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Icon name="send" />
                            Gửi tin nhắn
                        </button>
                    </form>
                </Card>

                {/* FAQ */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-6">Câu hỏi thường gặp</h2>
                    <div className="space-y-4">
                        {[
                            {
                                q: 'Làm sao để đặt lại mật khẩu?',
                                a: 'Bạn có thể nhấn "Quên mật khẩu" ở trang đăng nhập và làm theo hướng dẫn được gửi qua email.'
                            },
                            {
                                q: 'Tôi có thể hủy đăng ký Pro không?',
                                a: 'Có, bạn có thể hủy bất cứ lúc nào trong phần Cài đặt > Đăng ký. Bạn vẫn được sử dụng cho đến hết chu kỳ.'
                            },
                            {
                                q: 'Làm sao để xóa tài khoản?',
                                a: 'Vào Cài đặt > Tài khoản > Xóa tài khoản. Lưu ý: hành động này không thể hoàn tác.'
                            },
                        ].map((item, i) => (
                            <details
                                key={i}
                                className="group bg-surface-dark rounded-2xl p-4 border border-border-color"
                            >
                                <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-bold text-lg outline-none">
                                    <h3>{item.q}</h3>
                                    <Icon name="expand_more" className="transition group-open:rotate-180" />
                                </summary>
                                <p className="mt-4 leading-relaxed text-gray-300">
                                    {item.a}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>

                <Footer />
            </div>
        </div>
    );
}
