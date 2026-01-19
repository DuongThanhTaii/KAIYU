import React from 'react';
import Link from 'next/link';
import LandingNavbar from '@/components/layout/LandingNavbar';
import Footer from '@/components/layout/Footer';
import Icon from '@/components/common/Icon';

export default function TermsPage() {
    return (
        <div className="bg-background-dark text-white font-display min-h-screen">
            <LandingNavbar />

            <div className="max-w-4xl mx-auto px-4 pt-32 pb-20">
                {/* Back Link */}
                <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
                    <Icon name="arrow_back" size="sm" />
                    Quay lại trang chủ
                </Link>

                <h1 className="text-4xl font-black mb-8">Điều Khoản Sử Dụng</h1>
                <p className="text-text-secondary mb-8">Cập nhật lần cuối: Tháng 12, 2024</p>

                <div className="prose prose-invert prose-lg max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. Giới Thiệu</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Chào mừng bạn đến với KAIYU (&quot;Dịch vụ&quot;). Bằng việc truy cập hoặc sử dụng dịch vụ của chúng tôi,
                            bạn đồng ý tuân thủ và chịu ràng buộc bởi các điều khoản và điều kiện sau đây.
                            Nếu bạn không đồng ý với bất kỳ phần nào của các điều khoản này, vui lòng không sử dụng dịch vụ của chúng tôi.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. Tài Khoản Người Dùng</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Khi tạo tài khoản, bạn đồng ý:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2">
                            <li>Cung cấp thông tin chính xác, đầy đủ và cập nhật</li>
                            <li>Bảo mật mật khẩu và thông tin đăng nhập của bạn</li>
                            <li>Chịu trách nhiệm về mọi hoạt động xảy ra dưới tài khoản của bạn</li>
                            <li>Thông báo ngay cho chúng tôi nếu phát hiện truy cập trái phép</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. Quyền Sở Hữu Trí Tuệ</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Tất cả nội dung trên KAIYU, bao gồm nhưng không giới hạn: video, bài học, từ vựng,
                            hình ảnh, logo và thiết kế giao diện đều thuộc sở hữu của chúng tôi hoặc các đối tác được cấp phép.
                            Bạn không được sao chép, phân phối, sửa đổi hoặc sử dụng cho mục đích thương mại mà không có sự cho phép bằng văn bản.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">4. Quy Tắc Sử Dụng</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Khi sử dụng dịch vụ, bạn cam kết không:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2">
                            <li>Vi phạm bất kỳ luật pháp hoặc quy định nào</li>
                            <li>Sử dụng dịch vụ để spam hoặc quấy rối người dùng khác</li>
                            <li>Cố gắng truy cập trái phép vào hệ thống</li>
                            <li>Chia sẻ tài khoản với người khác</li>
                            <li>Sử dụng bot hoặc công cụ tự động để truy cập dịch vụ</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">5. Thanh Toán và Hoàn Tiền</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            <strong>Gói Pro:</strong> Thanh toán được thực hiện theo chu kỳ hàng tháng hoặc hàng năm.
                            Bạn có thể hủy đăng ký bất cứ lúc nào và sẽ tiếp tục sử dụng cho đến hết chu kỳ đã thanh toán.
                        </p>
                        <p className="text-gray-300 leading-relaxed">
                            <strong>Hoàn tiền:</strong> Chúng tôi hỗ trợ hoàn tiền trong vòng 7 ngày kể từ ngày thanh toán
                            nếu bạn chưa sử dụng quá 10% nội dung học tập.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">6. Giới Hạn Trách Nhiệm</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Dịch vụ được cung cấp &quot;nguyên trạng&quot; và &quot;sẵn có&quot;. Chúng tôi không đảm bảo dịch vụ sẽ không bị gián đoạn
                            hoặc không có lỗi. Chúng tôi không chịu trách nhiệm cho bất kỳ thiệt hại gián tiếp, ngẫu nhiên hoặc
                            do hậu quả nào phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">7. Thay Đổi Điều Khoản</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Chúng tôi có quyền cập nhật hoặc sửa đổi các điều khoản này bất cứ lúc nào.
                            Các thay đổi sẽ có hiệu lực ngay khi được đăng tải. Việc bạn tiếp tục sử dụng dịch vụ
                            sau khi thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">8. Liên Hệ</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Nếu bạn có bất kỳ câu hỏi nào về các điều khoản này, vui lòng liên hệ với chúng tôi qua
                            trang <Link href="/contact" className="text-primary hover:underline">Liên hệ</Link>.
                        </p>
                    </section>
                </div>

                <div className="mt-16">
                    <Footer />
                </div>
            </div>
        </div>
    );
}
