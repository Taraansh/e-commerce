import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AllExceptionFilter } from './httpExceptionFilter';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import config from 'config';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    MongooseModule.forRoot(config.get('mongoDBUrl')),
    UsersModule,
    ProductsModule,
    OrdersModule,
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        auth: { user: 'venom200011@gmail.com', pass: 'yzvknhjlzxcmtfmi' },
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: 'APP_FILTER', useClass: AllExceptionFilter },
  ],
})
export class AppModule {}
