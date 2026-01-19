import React from 'react';
import Link from 'next/link';
import LandingNavbar from '@/components/layout/LandingNavbar';
import Footer from '@/components/layout/Footer';
import Icon from '@/components/common/Icon';

export default function PrivacyPage() {
    return (
        <div className="bg-background-dark text-white font-display min-h-screen">
            <LandingNavbar />

            <div className="max-w-4xl mx-auto px-4 pt-32 pb-20">
                {/* Back Link */}
                <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
                    <Icon name="arrow_back" size="sm" />
                    Quay lại trang chủ
                </Link>

                <h1 className="text-4xl font-black mb-8">Chính Sách Bảo Mật</h1>
                <p className="text-text-secondary mb-8">Cập nhật lần cuối: Tháng 12, 2024</p>

                <div className="prose prose-invert prose-lg max-w-none space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. Thông Tin Chúng Tôi Thu Thập</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Khi bạn sử dụng KAIYU, chúng tôi có thể thu thập các loại thông tin sau:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2">
                            <li><strong>Thông tin cá nhân:</strong> Họ tên, địa chỉ email, ảnh đại diện</li>
                            <li><strong>Thông tin học tập:</strong> Tiến độ học, từ vựng đã học, video đã xem</li>
                            <li><strong>Thông tin thiết bị:</strong> Loại trình duyệt, hệ điều hành, địa chỉ IP</li>
                            <li><strong>Cookies:</strong> Để cải thiện trải nghiệm người dùng</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. Mục Đích Sử Dụng Thông Tin</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Chúng tôi sử dụng thông tin thu thập để:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2">
                            <li>Cung cấp và cải thiện dịch vụ học tập</li>
                            <li>Cá nhân hóa nội dung và đề xuất bài học phù hợp</li>
                            <li>Theo dõi tiến độ học tập và cung cấp báo cáo</li>
                            <li>Gửi thông báo về cập nhật, tính năng mới (có thể tắt)</li>
                            <li>Phân tích và cải thiện hiệu suất ứng dụng</li>
                            <li>Phát hiện và ngăn chặn gian lận hoặc lạm dụng</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. Chia Sẻ Thông Tin</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Chúng tôi <strong>KHÔNG</strong> bán thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ trong các trường hợp:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2">
                            <li>Khi có sự đồng ý của bạn</li>
                            <li>Với các đối tác cung cấp dịch vụ (thanh toán, lưu trữ) được bảo mật nghiêm ngặt</li>
                            <li>Khi được yêu cầu bởi pháp luật hoặc cơ quan có thẩm quyền</li>
                            <li>Để bảo vệ quyền lợi và an toàn của người dùng khác</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">4. Bảo Mật Dữ Liệu</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn ngành để bảo vệ thông tin của bạn:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2 mt-4">
                            <li>Mã hóa SSL/TLS cho tất cả kết nối</li>
                            <li>Mật khẩu được băm (hashed) an toàn, không lưu dạng văn bản</li>
                            <li>Token xác thực JWT với thời hạn giới hạn</li>
                            <li>Giám sát 24/7 và cập nhật bảo mật thường xuyên</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">5. Cookies và Công Nghệ Theo Dõi</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Chúng tôi sử dụng cookies để:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2">
                            <li>Duy trì phiên đăng nhập của bạn</li>
                            <li>Ghi nhớ tùy chọn và cài đặt</li>
                            <li>Phân tích lưu lượng truy cập (Google Analytics)</li>
                        </ul>
                        <p className="text-gray-300 leading-relaxed mt-4">
                            Bạn có thể tắt cookies trong trình duyệt, tuy nhiên một số tính năng có thể không hoạt động đúng.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">6. Quyền Của Bạn</h2>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Bạn có quyền:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2">
                            <li><strong>Truy cập:</strong> Xem thông tin cá nhân chúng tôi lưu trữ về bạn</li>
                            <li><strong>Chỉnh sửa:</strong> Cập nhật hoặc sửa thông tin không chính xác</li>
                            <li><strong>Xóa:</strong> Yêu cầu xóa tài khoản và dữ liệu liên quan</li>
                            <li><strong>Xuất dữ liệu:</strong> Tải về tiến độ học tập của bạn</li>
                            <li><strong>Hủy đăng ký:</strong> Tắt email thông báo bất cứ lúc nào</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">7. Lưu Trữ Dữ Liệu</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Chúng tôi lưu trữ dữ liệu của bạn trong suốt thời gian bạn sử dụng dịch vụ.
                            Sau khi xóa tài khoản, dữ liệu sẽ được xóa trong vòng 30 ngày,
                            ngoại trừ các thông tin cần thiết cho mục đích pháp lý hoặc tài chính.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">8. Thay Đổi Chính Sách</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Chúng tôi có thể cập nhật chính sách này theo thời gian.
                            Thay đổi quan trọng sẽ được thông báo qua email hoặc thông báo trên ứng dụng
                            trước khi có hiệu lực.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">9. Liên Hệ</h2>
                        <p className="text-gray-300 leading-relaxed">
                            Nếu bạn có câu hỏi về chính sách bảo mật hoặc muốn thực hiện quyền của mình,
                            vui lòng liên hệ qua trang <Link href="/contact" className="text-primary hover:underline">Liên hệ</Link>.
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
