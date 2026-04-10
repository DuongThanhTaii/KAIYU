import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET) returns 404 when no root controller is mounted', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('auth core flow: /auth/me requires JWT', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('learn core flow: /videos/recommendations requires JWT', () => {
    return request(app.getHttpServer())
      .get('/videos/recommendations')
      .expect(401);
  });

  it('review core flow: /flashcards/queue requires JWT', () => {
    return request(app.getHttpServer()).get('/flashcards/queue').expect(401);
  });

  it('admin core flow: /admin/stats/overview requires JWT', () => {
    return request(app.getHttpServer())
      .get('/admin/stats/overview')
      .expect(401);
  });
});
