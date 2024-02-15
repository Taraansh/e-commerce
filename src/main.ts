import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import config from 'config';
import { NextFunction, raw, Request, Response } from 'express';
import csurf from 'csurf';
const ROOT_IGNORED_PATHS = [
  '/api/v1/orders/webhook',
  '/api/v1/products?homepage=true',
  '/api/v1/users/login',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors();
  app.use(cookieParser());
  app.use('/api/v1/orders/webhook', raw({ type: '*/*' }));

  const csrfMiddleware = csurf({
    cookie: true,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (ROOT_IGNORED_PATHS.includes(req.path)) {
      return next();
    }
    return csrfMiddleware(req, res, next);
  });

  app.setGlobalPrefix(config.get('appPrefix'));
  await app.listen(config.get('port'));
}
bootstrap();
