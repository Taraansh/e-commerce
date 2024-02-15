import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { UserRepository } from 'src/shared/repositories/user.repository';
import { ProductsRepository } from 'src/shared/repositories/product.repository';
import { OrdersRepository } from 'src/shared/repositories/order.repository';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from 'src/shared/middleware/roles.guard';
import { StripeModule } from 'nestjs-stripe';
import config from 'config';
import { ProductSchema, Products } from 'src/shared/schema/products';
import { Users, UsersSchema } from 'src/shared/schema/users';
import { License, LicenseSchema } from 'src/shared/schema/license';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderSchema, Orders } from 'src/shared/schema/orders';
import { AuthMiddleware } from 'src/shared/middleware/auth';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    UserRepository,
    ProductsRepository,
    OrdersRepository,
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    MongooseModule.forFeature([{ name: Products.name, schema: ProductSchema }]),
    MongooseModule.forFeature([{ name: Users.name, schema: UsersSchema }]),
    MongooseModule.forFeature([{ name: License.name, schema: LicenseSchema }]),
    MongooseModule.forFeature([{ name: Orders.name, schema: OrderSchema }]),
    StripeModule.forRoot({
      apiKey: config.get('stripe.secret_key'),
      apiVersion: '2023-10-16',
    }),
  ],
})
export class OrdersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      // .exclude({
      //   path: `/orders/webhook`,
      //   method: RequestMethod.POST,
      // })
      // .exclude({ path: `/orders/:id`, method: RequestMethod.GET })
      .forRoutes(
        { path: `/orders/checkout`, method: RequestMethod.POST },
        { path: `/orders`, method: RequestMethod.GET },
      );
  }
}
