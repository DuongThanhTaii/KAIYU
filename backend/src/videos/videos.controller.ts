import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  VideoQueryDto,
  VideoRecommendationQueryDto,
} from './dto';
import { CurrentUser } from '../auth/decorators';
import { RecommendationService } from './recommendation.service';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get list of published videos' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'hskLevel', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of videos with pagination' })
  async findAll(@Query() query: VideoQueryDto) {
    return this.videosService.findAll(query);
  }

  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all videos including unpublished (Admin)' })
  @ApiResponse({ status: 200, description: 'List of all videos' })
  async findAllAdmin(@Query() query: VideoQueryDto) {
    return this.videosService.findAll(query, true);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all video categories with counts' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories() {
    return this.videosService.getCategories();
  }

  @Get('recommendations')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized video recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations grouped by lane' })
  async getRecommendations(
    @CurrentUser() user: { id: string },
    @Query() query: VideoRecommendationQueryDto,
  ) {
    return this.recommendationService.getRecommendations(
      user.id,
      query.context || 'learn',
      query.limit || 4,
      Boolean(query.forceRefresh),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get video details by ID' })
  @ApiResponse({ status: 200, description: 'Video details' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async findOne(@Param('id') id: string) {
    return this.videosService.findOne(id);
  }

  @Get(':id/subtitles')
  @ApiOperation({ summary: 'Get all subtitles for a video' })
  @ApiResponse({ status: 200, description: 'List of subtitles with tokens' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getSubtitles(@Param('id') id: string) {
    return this.videosService.getSubtitles(id);
  }

  @Get(':id/vocabulary')
  @ApiOperation({ summary: 'Get vocabulary words from a video' })
  @ApiResponse({ status: 200, description: 'List of vocabulary words' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getVocabulary(@Param('id') id: string) {
    return this.videosService.getVocabulary(id);
  }

  @Post(':id/view')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a video view (requires 40s watch time)' })
  @ApiResponse({ status: 200, description: 'View recorded or already counted' })
  async recordView(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { watchedSeconds: number },
  ) {
    // Only count view if user watched at least 40 seconds
    if (body.watchedSeconds < 40) {
      return { counted: false, message: 'Watch time below threshold (40s)' };
    }
    return this.videosService.incrementViewCount(id, user.id);
  }

  // Admin endpoints
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new video (Admin)' })
  @ApiResponse({ status: 201, description: 'Video created' })
  async create(@Body() createVideoDto: CreateVideoDto) {
    return this.videosService.create(createVideoDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a video (Admin)' })
  @ApiResponse({ status: 200, description: 'Video updated' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async update(
    @Param('id') id: string,
    @Body() updateVideoDto: UpdateVideoDto,
  ) {
    return this.videosService.update(id, updateVideoDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a video (Admin)' })
  @ApiResponse({ status: 200, description: 'Video deleted' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a video (Admin)' })
  @ApiResponse({ status: 200, description: 'Video published' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async publish(@Param('id') id: string) {
    return this.videosService.publish(id);
  }

  @Post(':id/subtitles')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload subtitles for a video (Admin)' })
  @ApiResponse({ status: 201, description: 'Subtitles uploaded and parsed' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async uploadSubtitles(
    @Param('id') id: string,
    @Body() body: { content: string; filename: string },
  ) {
    return this.videosService.uploadSubtitles(id, body.content, body.filename);
  }

  @Post('youtube/info')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get YouTube video info (duration, title, thumbnail)',
  })
  @ApiResponse({ status: 200, description: 'YouTube video information' })
  async getYouTubeInfo(@Body() body: { url: string }) {
    return this.videosService.getYouTubeVideoInfo(body.url);
  }
}
