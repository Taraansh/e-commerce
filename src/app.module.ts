import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AllExceptionFilter } from './httpExceptionFilter';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import config from 'config'

@Module({
  imports: [
    MongooseModule.forRoot(config.get('mongoDBUrl')),
    UsersModule,
    ProductsModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: 'APP_FILTER', useClass: AllExceptionFilter },
  ],
})
export class AppModule {}
