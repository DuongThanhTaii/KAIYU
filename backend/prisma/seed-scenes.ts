import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Scene Templates with branching dialogs
const sceneTemplates = [
    {
        name: 'Coffee Shop',
        nameVi: 'Quán Cà Phê',
        description: 'Order a drink at a coffee shop in Beijing',
        category: 'daily_life',
        hskLevel: 2,
        difficulty: 'easy',
        vocabSlots: ['drink', 'adjective'],
        dialogFlow: {
            start: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '你好！欢迎光临！想喝点什么？',
                textVi: 'Xin chào! Chào mừng quý khách! Bạn muốn uống gì?',
                pinyin: 'Nǐ hǎo! Huānyíng guānglín! Xiǎng hē diǎn shénme?',
                choices: [
                    { id: 'a', text: '我要一杯{drink}。', textVi: 'Cho tôi một ly {drink}.', next: 'hot_cold', correct: true },
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
                    { id: 'a', text: '好，我要一杯拿铁。', textVi: 'Được, cho tôi một ly latte.', next: 'hot_cold' },
                    { id: 'b', text: '有别的吗？', textVi: 'Có cái khác không?', next: 'other_options' }
                ]
            },
            price_first: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '咖啡二十块，奶茶十五块。',
                textVi: 'Cà phê 20 tệ, trà sữa 15 tệ.',
                pinyin: 'Kāfēi èrshí kuài, nǎichá shíwǔ kuài.',
                choices: [
                    { id: 'a', text: '我要咖啡。', textVi: 'Cho tôi cà phê.', next: 'hot_cold' },
                    { id: 'b', text: '我要奶茶。', textVi: 'Cho tôi trà sữa.', next: 'hot_cold' }
                ]
            },
            other_options: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '还有美式、卡布奇诺、抹茶拿铁。',
                textVi: 'Còn có Americano, Cappuccino, Matcha Latte.',
                pinyin: 'Hái yǒu měishì, kǎbùqínuò, mǒchá nǎtiě.',
                choices: [
                    { id: 'a', text: '美式吧。', textVi: 'Americano đi.', next: 'hot_cold' }
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
                    { id: 'b', text: '支付宝。', textVi: 'Alipay.', next: 'end_success' },
                    { id: 'c', text: '可以用现金吗？', textVi: 'Có thể dùng tiền mặt không?', next: 'cash' }
                ]
            },
            cash: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '可以的！',
                textVi: 'Được ạ!',
                pinyin: 'Kěyǐ de!',
                choices: [
                    { id: 'a', text: '给你。', textVi: 'Đây.', next: 'end_success' }
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
        name: 'Restaurant',
        nameVi: 'Nhà Hàng',
        description: 'Order food at a Chinese restaurant',
        category: 'daily_life',
        hskLevel: 2,
        difficulty: 'easy',
        vocabSlots: ['food', 'dish'],
        dialogFlow: {
            start: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '欢迎光临！几位？',
                textVi: 'Chào mừng! Mấy người?',
                pinyin: 'Huānyíng guānglín! Jǐ wèi?',
                choices: [
                    { id: 'a', text: '两位。', textVi: 'Hai người.', next: 'seat' },
                    { id: 'b', text: '一个人。', textVi: 'Một mình.', next: 'seat' }
                ]
            },
            seat: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '好的，请坐！这是菜单。',
                textVi: 'Được, mời ngồi! Đây là thực đơn.',
                pinyin: 'Hǎo de, qǐng zuò! Zhè shì càidān.',
                choices: [
                    { id: 'a', text: '谢谢！有什么推荐？', textVi: 'Cảm ơn! Có gì giới thiệu không?', next: 'recommend' },
                    { id: 'b', text: '我要{food}。', textVi: 'Cho tôi {food}.', next: 'drink', correct: true }
                ]
            },
            recommend: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '我们的宫保鸡丁很好吃！',
                textVi: 'Gà Kung Pao của chúng tôi rất ngon!',
                pinyin: 'Wǒmen de gōngbǎo jīdīng hěn hǎochī!',
                choices: [
                    { id: 'a', text: '好，我要这个。', textVi: 'Được, cho tôi món này.', next: 'drink' },
                    { id: 'b', text: '有素菜吗？', textVi: 'Có món chay không?', next: 'vegetarian' }
                ]
            },
            vegetarian: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '有的！有地三鲜和麻婆豆腐。',
                textVi: 'Có! Có Địa Tam Tiên và Đậu hũ Tứ Xuyên.',
                pinyin: 'Yǒu de! Yǒu dìsānxiān hé mápó dòufu.',
                choices: [
                    { id: 'a', text: '我要麻婆豆腐。', textVi: 'Cho tôi Đậu hũ Tứ Xuyên.', next: 'drink' }
                ]
            },
            drink: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '好的！要喝什么？',
                textVi: 'Được! Uống gì?',
                pinyin: 'Hǎo de! Yào hē shénme?',
                choices: [
                    { id: 'a', text: '一瓶啤酒。', textVi: 'Một chai bia.', next: 'rice' },
                    { id: 'b', text: '一杯可乐。', textVi: 'Một ly cola.', next: 'rice' },
                    { id: 'c', text: '白开水就好。', textVi: 'Nước lọc thôi.', next: 'rice' }
                ]
            },
            rice: {
                speaker: '服务员',
                speakerVi: 'Nhân viên',
                text: '要米饭吗？',
                textVi: 'Cần cơm không?',
                pinyin: 'Yào mǐfàn ma?',
                choices: [
                    { id: 'a', text: '要，两碗。', textVi: 'Cần, hai bát.', next: 'end_success' },
                    { id: 'b', text: '不用了，谢谢。', textVi: 'Không cần, cảm ơn.', next: 'end_success' }
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
    },
    {
        name: 'Taxi',
        nameVi: 'Đi Taxi',
        description: 'Take a taxi ride in China',
        category: 'travel',
        hskLevel: 2,
        difficulty: 'easy',
        vocabSlots: ['place', 'direction'],
        dialogFlow: {
            start: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '你好！去哪儿？',
                textVi: 'Xin chào! Đi đâu?',
                pinyin: 'Nǐ hǎo! Qù nǎr?',
                choices: [
                    { id: 'a', text: '去{place}。', textVi: 'Đến {place}.', next: 'confirm', correct: true },
                    { id: 'b', text: '去机场。', textVi: 'Đến sân bay.', next: 'airport' },
                    { id: 'c', text: '去火车站。', textVi: 'Đến ga tàu.', next: 'confirm' }
                ]
            },
            confirm: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '好的！系好安全带。',
                textVi: 'Được! Thắt dây an toàn nhé.',
                pinyin: 'Hǎo de! Jì hǎo ānquándài.',
                choices: [
                    { id: 'a', text: '好的。大概多长时间？', textVi: 'Được. Khoảng bao lâu?', next: 'time' }
                ]
            },
            airport: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '哪个航站楼？',
                textVi: 'Nhà ga nào?',
                pinyin: 'Nǎge hángzhànlóu?',
                choices: [
                    { id: 'a', text: '一号航站楼。', textVi: 'Nhà ga số 1.', next: 'confirm' },
                    { id: 'b', text: '二号航站楼。', textVi: 'Nhà ga số 2.', next: 'confirm' }
                ]
            },
            time: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '不堵车的话，大概二十分钟。',
                textVi: 'Nếu không kẹt xe, khoảng 20 phút.',
                pinyin: 'Bù dǔchē de huà, dàgài èrshí fēnzhōng.',
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
                    { id: 'a', text: '微信付款。', textVi: 'Thanh toán WeChat.', next: 'end_success' },
                    { id: 'b', text: '给你四十，不用找了。', textVi: 'Đây 40, không cần thối.', next: 'end_tip' }
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
            },
            end_tip: {
                speaker: '司机',
                speakerVi: 'Tài xế',
                text: '哎呀，太客气了！谢谢！',
                textVi: 'Ôi, khách sáo quá! Cảm ơn!',
                pinyin: 'Āiyā, tài kèqì le! Xièxiè!',
                isEnd: true,
                score: 100
            }
        }
    },
    {
        name: 'Shopping',
        nameVi: 'Mua Sắm',
        description: 'Bargain at a market in China',
        category: 'daily_life',
        hskLevel: 3,
        difficulty: 'medium',
        vocabSlots: ['item', 'color'],
        dialogFlow: {
            start: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '你好！看看！有什么需要？',
                textVi: 'Xin chào! Xem đi! Cần gì không?',
                pinyin: 'Nǐ hǎo! Kànkan! Yǒu shénme xūyào?',
                choices: [
                    { id: 'a', text: '这个{item}多少钱？', textVi: 'Cái {item} này bao nhiêu?', next: 'price', correct: true },
                    { id: 'b', text: '我随便看看。', textVi: 'Tôi xem thôi.', next: 'browse' }
                ]
            },
            price: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '这个很好的！一百块！',
                textVi: 'Cái này tốt lắm! 100 tệ!',
                pinyin: 'Zhège hěn hǎo de! Yībǎi kuài!',
                choices: [
                    { id: 'a', text: '太贵了！便宜一点吧。', textVi: 'Đắt quá! Bớt đi.', next: 'bargain' },
                    { id: 'b', text: '好的，我要了。', textVi: 'Được, tôi lấy.', next: 'end_full' }
                ]
            },
            browse: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '慢慢看！有问题问我！',
                textVi: 'Từ từ xem! Có gì hỏi tôi!',
                pinyin: 'Mànmàn kàn! Yǒu wèntí wèn wǒ!',
                choices: [
                    { id: 'a', text: '这个怎么卖？', textVi: 'Cái này bán thế nào?', next: 'price' }
                ]
            },
            bargain: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '那你说多少钱？',
                textVi: 'Vậy bạn nói bao nhiêu?',
                pinyin: 'Nà nǐ shuō duōshao qián?',
                choices: [
                    { id: 'a', text: '五十块怎么样？', textVi: '50 tệ được không?', next: 'bargain2' },
                    { id: 'b', text: '六十块吧。', textVi: '60 tệ đi.', next: 'accept' }
                ]
            },
            bargain2: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '不行不行，太少了！八十块，最低了！',
                textVi: 'Không được, ít quá! 80 tệ, thấp nhất rồi!',
                pinyin: 'Bùxíng bùxíng, tài shǎo le! Bāshí kuài, zuìdī le!',
                choices: [
                    { id: 'a', text: '好吧，七十块。', textVi: 'Thôi được, 70 tệ.', next: 'accept' },
                    { id: 'b', text: '算了，我不要了。', textVi: 'Thôi, tôi không mua.', next: 'walk_away' }
                ]
            },
            walk_away: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '等等！好吧好吧，六十块给你！',
                textVi: 'Đợi đã! Thôi được, 60 tệ cho bạn!',
                pinyin: 'Děngděng! Hǎo ba hǎo ba, liùshí kuài gěi nǐ!',
                choices: [
                    { id: 'a', text: '成交！', textVi: 'Thành giao!', next: 'end_bargain' }
                ]
            },
            accept: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '好好好！成交！',
                textVi: 'Được được được! Thành giao!',
                pinyin: 'Hǎo hǎo hǎo! Chéngjiāo!',
                choices: [
                    { id: 'a', text: '微信扫一扫。', textVi: 'Quét WeChat.', next: 'end_bargain' }
                ]
            },
            end_full: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '谢谢老板！慢走！',
                textVi: 'Cảm ơn! Đi chậm thôi!',
                pinyin: 'Xièxiè lǎobǎn! Màn zǒu!',
                isEnd: true,
                score: 80
            },
            end_bargain: {
                speaker: '老板',
                speakerVi: 'Chủ cửa hàng',
                text: '好的！谢谢！欢迎下次再来！',
                textVi: 'Được! Cảm ơn! Lần sau lại đến nhé!',
                pinyin: 'Hǎo de! Xièxiè! Huānyíng xià cì zài lái!',
                isEnd: true,
                score: 100
            }
        }
    },
    {
        name: 'Hotel Check-in',
        nameVi: 'Nhận Phòng Khách Sạn',
        description: 'Check into a hotel in China',
        category: 'travel',
        hskLevel: 3,
        difficulty: 'medium',
        vocabSlots: ['room_type', 'days'],
        dialogFlow: {
            start: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '您好！欢迎光临！请问有预订吗？',
                textVi: 'Xin chào! Chào mừng quý khách! Quý khách có đặt trước không?',
                pinyin: 'Nín hǎo! Huānyíng guānglín! Qǐngwèn yǒu yùdìng ma?',
                choices: [
                    { id: 'a', text: '有的，我姓李。', textVi: 'Có, tôi họ Lý.', next: 'have_booking' },
                    { id: 'b', text: '没有，我想现在订。', textVi: 'Không, tôi muốn đặt ngay.', next: 'no_booking' }
                ]
            },
            have_booking: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '找到了！李先生，预订了两晚标准间，对吗？',
                textVi: 'Tìm thấy rồi! Anh Lý, đặt phòng tiêu chuẩn 2 đêm, đúng không?',
                pinyin: 'Zhǎodào le! Lǐ xiānsheng, yùdìng le liǎng wǎn biāozhǔn jiān, duì ma?',
                choices: [
                    { id: 'a', text: '对的。', textVi: 'Đúng rồi.', next: 'passport' },
                    { id: 'b', text: '不对，是三晚。', textVi: 'Không, là 3 đêm.', next: 'correct_nights' }
                ]
            },
            no_booking: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '好的！想要什么类型的房间？',
                textVi: 'Được! Quý khách muốn loại phòng nào?',
                pinyin: 'Hǎo de! Xiǎng yào shénme lèixíng de fángjiān?',
                choices: [
                    { id: 'a', text: '一间{room_type}。', textVi: 'Một phòng {room_type}.', next: 'how_many_nights', correct: true },
                    { id: 'b', text: '最便宜的房间。', textVi: 'Phòng rẻ nhất.', next: 'cheapest' }
                ]
            },
            cheapest: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '经济房一晚两百八。',
                textVi: 'Phòng kinh tế 280 tệ/đêm.',
                pinyin: 'Jīngjì fáng yī wǎn liǎngbǎi bā.',
                choices: [
                    { id: 'a', text: '好，就这个。', textVi: 'Được, phòng đó.', next: 'how_many_nights' }
                ]
            },
            how_many_nights: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '住几晚？',
                textVi: 'Ở mấy đêm?',
                pinyin: 'Zhù jǐ wǎn?',
                choices: [
                    { id: 'a', text: '两晚。', textVi: 'Hai đêm.', next: 'passport' },
                    { id: 'b', text: '三晚。', textVi: 'Ba đêm.', next: 'passport' }
                ]
            },
            correct_nights: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '抱歉！我帮您改一下。三晚，对吧？',
                textVi: 'Xin lỗi! Để tôi sửa. Ba đêm đúng không?',
                pinyin: 'Bàoqiàn! Wǒ bāng nín gǎi yīxià. Sān wǎn, duì ba?',
                choices: [
                    { id: 'a', text: '对，谢谢。', textVi: 'Đúng, cảm ơn.', next: 'passport' }
                ]
            },
            passport: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '好的！请出示护照。',
                textVi: 'Được! Xin cho xem hộ chiếu.',
                pinyin: 'Hǎo de! Qǐng chūshì hùzhào.',
                choices: [
                    { id: 'a', text: '给你。', textVi: 'Đây.', next: 'deposit' }
                ]
            },
            deposit: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '需要交五百块押金。退房时退还。',
                textVi: 'Cần đặt cọc 500 tệ. Trả phòng sẽ hoàn lại.',
                pinyin: 'Xūyào jiāo wǔbǎi kuài yājīn. Tuìfáng shí tuìhuán.',
                choices: [
                    { id: 'a', text: '好的，没问题。', textVi: 'Được, không sao.', next: 'key' }
                ]
            },
            key: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '这是房卡。您的房间在八楼，808号。电梯在那边。',
                textVi: 'Đây là thẻ phòng. Phòng của anh ở tầng 8, số 808. Thang máy ở đằng kia.',
                pinyin: 'Zhè shì fángkǎ. Nín de fángjiān zài bā lóu, 808 hào. Diàntī zài nàbiān.',
                choices: [
                    { id: 'a', text: '谢谢！早餐几点？', textVi: 'Cảm ơn! Bữa sáng mấy giờ?', next: 'breakfast' },
                    { id: 'b', text: '谢谢！', textVi: 'Cảm ơn!', next: 'end_success' }
                ]
            },
            breakfast: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '早餐在一楼餐厅，七点到十点。',
                textVi: 'Bữa sáng ở nhà hàng tầng 1, 7 giờ đến 10 giờ.',
                pinyin: 'Zǎocān zài yī lóu cāntīng, qī diǎn dào shí diǎn.',
                choices: [
                    { id: 'a', text: '好的，谢谢！', textVi: 'Được, cảm ơn!', next: 'end_success' }
                ]
            },
            end_success: {
                speaker: '前台',
                speakerVi: 'Lễ tân',
                text: '祝您住宿愉快！',
                textVi: 'Chúc quý khách nghỉ ngơi vui vẻ!',
                pinyin: 'Zhù nín zhùsù yúkuài!',
                isEnd: true,
                score: 100
            }
        }
    }
];

async function seedSceneTemplates() {
    console.log('🎬 Seeding Scene Templates...');

    for (const template of sceneTemplates) {
        const existing = await prisma.sceneTemplate.findFirst({
            where: { name: template.name }
        });

        if (!existing) {
            await prisma.sceneTemplate.create({
                data: template
            });
            console.log(`  ✓ Created template: ${template.name}`);
        } else {
            console.log(`  ⊘ Template already exists: ${template.name}`);
        }
    }

    console.log('✅ Scene Templates seeded!');
}

seedSceneTemplates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
