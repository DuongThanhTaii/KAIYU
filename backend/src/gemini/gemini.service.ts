import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not set in environment variables. AI features will fail.',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey || 'missing-key');
    // gemini-2.5-flash is the supported fast model for this API version
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateQuizQuestions(subtitleData: string): Promise<any[]> {
    const prompt = `
Bạn là một chuyên gia ngôn ngữ tiếng Trung giảng dạy HSK.
Dựa vào nội dung phụ đề tiếng Trung và tiếng Việt bên dưới, hãy tạo các câu hỏi trắc nghiệm điền vào chỗ trống.
Tiêu chuẩn chọn từ để tạo chỗ trống:
- Nên là các từ đóng vai trò quan trọng trong câu (động từ chính, danh từ, đại từ, lượng từ, liên từ...).
- Mỗi câu chỉ tạo 1 chỗ trống (từ 1 đến 3 ký tự Hán tự).

Yêu cầu output:
1. Tạo 3 đáp án sai (option1, option2, option3) có tính gây nhiễu, nhưng phải cùng loại từ hoặc hợp lý về mặt ngữ pháp để học viên phải suy nghĩ.
2. Trả về đúng định dạng JSON MẢNG chứa các object có cấu trúc chuẩn như sau (không thêm markdown \`\`\`json ở ngoài, CHỈ TRẢ VỀ MẢNG JSON):
[
  {
     "sentenceHanzi": "câu đầy đủ có chứa từ đúng",
     "blankWord": "từ đúng được làm chỗ trống",
     "option1": "đáp án sai 1",
     "option2": "đáp án sai 2",
     "option3": "đáp án sai 3",
     "meaningVi": "dịch nghĩa tiếng Việt của toàn bộ câu"
  }
]

Nội dung phụ đề:
${subtitleData}
        `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      // Clean up backticks if model returns markdown json block
      text = text
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      // remove trailing backticks if any
      if (text.startsWith('```')) text = text.replace(/^```\s*/, '');
      if (text.endsWith('```')) text = text.replace(/```$/, '');

      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      this.logger.error(
        'Failed to parse Gemini response or generate content',
        e,
      );
      throw new InternalServerErrorException(
        'Không thể tạo câu hỏi từ AI hiện tại: ' + e.message,
      );
    }
  }
}
