import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformationInterceptor } from './responseInterceptor';
import cookieParser from 'cookie-parser'
import config from 'config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(config.get('appPrefix'))
  app.use(cookieParser());
  app.useGlobalInterceptors(new TransformationInterceptor());
  await app.listen(3000);
}
bootstrap();
