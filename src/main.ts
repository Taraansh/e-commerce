import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformationInterceptor } from './responseInterceptor';
import cookieParser from 'cookie-parser'
import config from 'config'
import { raw } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {rawBody: true});

  app.use(cookieParser());
  app.use('/api/v1/orders/webhook', raw({type: '*/*'}))
  app.setGlobalPrefix(config.get('appPrefix'))
  app.useGlobalInterceptors(new TransformationInterceptor());
  await app.listen(config.get("port"));
}
bootstrap();
