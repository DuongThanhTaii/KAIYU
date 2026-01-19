'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import LandingNavbar from '@/components/layout/LandingNavbar';
import Footer from '@/components/layout/Footer';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import Card from '@/components/common/Card';
import { videoApi, type Video } from '@/services/videoApi';
import { watchTimeTracker } from '@/services/watchTimeTracker';

export default function LandingPage() {
  const [featuredVideo, setFeaturedVideo] = useState<Video | null>(null);
  const [guestProgress, setGuestProgress] = useState<{ vocabCount: number; watchMinutes: number; hasProgress: boolean }>({ vocabCount: 0, watchMinutes: 0, hasProgress: false });

  useEffect(() => {
    const fetchFeaturedVideo = async () => {
      try {
        const response = await videoApi.getAll({ limit: 1 });
        if (response.data.length > 0) {
          setFeaturedVideo(response.data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch featured video:', error);
      }
    };
    fetchFeaturedVideo();

    // Load guest progress from localStorage
    const progress = watchTimeTracker.getStoredProgress();
    const hasProgress = progress.vocabCount > 0 || progress.totalWatchTimeSeconds > 0;
    setGuestProgress({
      vocabCount: progress.vocabCount,
      watchMinutes: Math.round(progress.totalWatchTimeSeconds / 60),
      hasProgress,
    });
  }, []);

  // Helper to get video thumbnail
  const getVideoThumbnail = (video: Video | null): string | null => {
    if (!video) return null;
    if (video.thumbnailUrl) return video.thumbnailUrl;
    if (videoApi.isYouTubeUrl(video.videoUrl)) {
      return videoApi.getYouTubeThumbnail(video.videoUrl);
    }
    return null;
  };
  return (
    <div className="bg-background-dark text-white font-display overflow-x-hidden selection:bg-primary selection:text-background-dark">
      <LandingNavbar />

      {/* Main Content */}
      <div className="flex flex-col items-center pt-28 pb-20 px-4 md:px-8 min-h-screen">
        <div className="max-w-[1024px] w-full flex flex-col gap-6">

          {/* Hero Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mb-12">
            <div className="md:col-span-7 flex flex-col gap-6 text-center md:text-left z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit mx-auto md:mx-0">
                <span className="size-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs font-bold text-primary uppercase tracking-wide">Phiên bản 2.0 đã ra mắt</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tight">
                Học tiếng Trung qua video với <span className="text-primary">phụ đề tương tác</span>
              </h1>

              <p className="text-gray-300 text-lg md:text-xl font-medium max-w-xl mx-auto md:mx-0">
                Nắm vững kỹ năng nghe và đọc một cách tự nhiên. Click vào bất kỳ từ nào để tra từ điển ngay lập tức.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start mt-2">
                <Link href="/login">
                  <Button variant="primary" size="lg" className="shadow-[0_0_20px_rgba(76,223,32,0.3)]">
                    Bắt đầu học miễn phí
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="lg"
                  leftIcon={<Icon name="play_circle" />}
                >
                  Xem demo
                </Button>
              </div>

              {/* Social Proof */}
              <div className="flex items-center justify-center md:justify-start gap-4 mt-4 opacity-80">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="size-10 rounded-full border-2 border-background-dark bg-gradient-to-br from-primary/50 to-emerald-600/50"
                    ></div>
                  ))}
                  <div className="size-10 rounded-full border-2 border-background-dark bg-surface-highlight flex items-center justify-center text-xs font-bold text-white">
                    +5k
                  </div>
                </div>
                <p className="text-sm font-medium">Người học tin dùng</p>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="md:col-span-5 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-teal-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-surface-dark border border-border-color rounded-2xl overflow-hidden shadow-2xl aspect-[4/5] md:aspect-square flex flex-col">
                {/* Mockup Header */}
                <div className="h-14 border-b border-border-color flex items-center justify-between px-6 bg-background-dark">
                  <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500"></div>
                    <div className="size-3 rounded-full bg-yellow-500"></div>
                    <div className="size-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="text-xs font-mono opacity-50">lesson_01.mp4</div>
                </div>

                {/* Mockup Content */}
                <div className="flex-1 bg-black relative overflow-hidden flex items-center justify-center">
                  {/* Video Thumbnail Background */}
                  {getVideoThumbnail(featuredVideo) && (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${getVideoThumbnail(featuredVideo)})` }}
                    />
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40" />

                  <div className="size-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white cursor-pointer hover:scale-110 transition-transform z-10">
                    <Icon name="play_arrow" size="xl" filled />
                  </div>

                  {/* Subtitle Mockup */}
                  <div className="absolute bottom-12 left-0 right-0 px-8 text-center z-10">
                    <div className="inline-block bg-black/60 backdrop-blur-md rounded-lg p-4 text-white text-xl md:text-2xl font-medium">
                      <span>你好，</span>
                      <span className="text-primary border-b-2 border-primary/50">我叫</span>
                      <span>小明。</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="flex flex-col gap-6 scroll-mt-24" id="features">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl md:text-3xl font-bold">Tính năng nổi bật</h2>
              <a href="#" className="text-primary font-bold text-sm hover:underline flex items-center">
                Xem tất cả <Icon name="arrow_forward" size="sm" className="ml-1" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">
              {/* Feature Card 1 */}
              <Card variant="default" padding="lg" hover className="md:col-span-2 md:row-span-2 relative overflow-hidden group">
                <div className="z-10">
                  <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-4">
                    <Icon name="touch_app" size="lg" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Tra từ điển 1 chạm</h3>
                  <p className="text-text-secondary max-w-xs">
                    Chạm vào bất kỳ từ nào để xem nghĩa, phiên âm Pinyin và ví dụ thực tế.
                  </p>
                </div>
                <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
              </Card>

              {/* Feature Card 2 */}
              <Card
                variant="default"
                padding="lg"
                className="md:col-span-2 bg-surface-highlight flex items-center justify-between relative overflow-hidden group"
              >
                <div className="z-10 max-w-[60%]">
                  <h3 className="text-xl font-bold mb-1">Ôn tập thông minh</h3>
                  <p className="text-sm text-gray-300">
                    Hệ thống lặp lại ngắt quãng (SRS) giúp bạn nhớ từ vựng lâu hơn.
                  </p>
                </div>
                <div className="size-20 bg-primary rounded-full flex items-center justify-center text-on-primary shadow-xl group-hover:scale-110 transition-transform">
                  <Icon name="psychology" size="xl" />
                </div>
              </Card>

              {/* Feature Card 3 */}
              <Card variant="default" padding="md" hover className="flex flex-col justify-center items-center text-center gap-4">
                <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative">
                  {getVideoThumbnail(featuredVideo) && (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${getVideoThumbnail(featuredVideo)})` }}
                    />
                  )}
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-bold text-white z-10">
                    {featuredVideo ? videoApi.formatDuration(featuredVideo.durationSeconds) : '04:20'}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Video thực tế</h3>
                  <p className="text-xs text-text-secondary mt-1">Học từ Vlogs, Phim & Tin tức</p>
                </div>
              </Card>

              {/* Feature Card 4 - Dynamic Progress */}
              <Card variant="default" padding="md" className="flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{guestProgress.hasProgress ? 'Tiến độ của bạn' : 'Bắt đầu hành trình'}</h3>
                    <Icon name={guestProgress.hasProgress ? 'trending_up' : 'rocket_launch'} className="text-primary" />
                  </div>
                  <div className="text-3xl font-black text-primary">
                    {guestProgress.hasProgress ? (
                      <>{guestProgress.vocabCount > 0 ? guestProgress.vocabCount : guestProgress.watchMinutes}<span className="text-lg font-bold ml-1">{guestProgress.vocabCount > 0 ? 'từ' : 'phút'}</span></>
                    ) : (
                      <>5000+<span className="text-lg font-bold ml-1">từ</span></>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {guestProgress.hasProgress
                      ? (guestProgress.vocabCount > 0 ? 'Từ vựng đã tra' : 'Thời gian đã học')
                      : 'Từ vựng HSK 1-6 đang chờ bạn'
                    }
                  </div>
                </div>
                <div className="w-full bg-surface-highlight h-2 rounded-full mt-4 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: guestProgress.hasProgress ? `${Math.min(100, (guestProgress.vocabCount / 50) * 100)}%` : '10%' }}
                  />
                </div>
              </Card>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="py-16 scroll-mt-20" id="pricing">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3">Bảng giá đơn giản</h2>
              <p className="text-text-secondary">Bắt đầu miễn phí, nâng cấp khi bạn sẵn sàng.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Free Plan */}
              <Card variant="default" padding="lg" className="flex flex-col">
                <div className="mb-4">
                  <span className="bg-surface-highlight text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Cơ bản
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black">0₫</span>
                  <span className="text-text-secondary">/tháng</span>
                </div>
                <ul className="flex-1 space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm">
                    <Icon name="check_circle" className="text-green-500" size="md" />
                    <span>3 video mỗi ngày</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Icon name="check_circle" className="text-green-500" size="md" />
                    <span>Tra từ điển cơ bản</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-text-secondary">
                    <Icon name="cancel" size="md" />
                    <span>Lưu từ vựng không giới hạn</span>
                  </li>
                </ul>
                <Button variant="outline" fullWidth>
                  Đăng ký miễn phí
                </Button>
              </Card>

              {/* Pro Plan */}
              <Card
                variant="elevated"
                padding="lg"
                className="relative border-2 border-primary flex flex-col shadow-[0_0_30px_rgba(76,223,32,0.15)]"
              >
                <div className="absolute top-0 right-0 bg-primary text-on-primary text-xs font-bold px-4 py-1 rounded-bl-xl rounded-tr-xl">
                  PHỔ BIẾN NHẤT
                </div>
                <div className="mb-4">
                  <span className="text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/30 uppercase tracking-wider bg-primary/10">
                    Pro
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black">99k</span>
                  <span className="text-text-secondary">/tháng</span>
                </div>
                <ul className="flex-1 space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-sm">
                    <Icon name="check_circle" className="text-primary" size="md" />
                    <span>Video không giới hạn</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Icon name="check_circle" className="text-primary" size="md" />
                    <span>Tra từ điển nâng cao & Offline</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Icon name="check_circle" className="text-primary" size="md" />
                    <span>Hệ thống ôn tập thông minh (SRS)</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Icon name="check_circle" className="text-primary" size="md" />
                    <span>Không quảng cáo</span>
                  </li>
                </ul>
                <Button variant="primary" fullWidth>
                  Nâng cấp Pro
                </Button>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="py-10 max-w-2xl mx-auto w-full scroll-mt-24" id="faq">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Câu hỏi thường gặp</h2>
            <div className="space-y-4">
              {[
                { q: 'Ứng dụng phù hợp với trình độ nào?', a: 'Chúng tôi có nội dung cho mọi trình độ từ HSK 1 đến HSK 6.' },
                { q: 'Tôi có thể sử dụng trên điện thoại không?', a: 'Có! Ứng dụng được tối ưu hóa hoàn toàn cho trình duyệt di động.' },
                { q: 'Chế độ thanh toán như thế nào?', a: 'Bạn có thể thanh toán qua thẻ tín dụng, Momo hoặc chuyển khoản ngân hàng.' },
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
    </div>
  );
}
