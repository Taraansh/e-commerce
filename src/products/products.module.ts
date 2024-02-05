import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductSchema, Products } from 'src/shared/schema/products';
import { Users, UsersSchema } from 'src/shared/schema/users';
import { StripeModule } from 'nestjs-stripe';
import config from 'config';
import { AuthMiddleware } from 'src/shared/middleware/auth';
import { ProductsRepository } from 'src/shared/repositories/product.repository';
import { UserRepository } from 'src/shared/repositories/user.repository';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from 'src/shared/middleware/roles.guard';
import { License, LicenseSchema } from 'src/shared/schema/license';

@Module({
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductsRepository,
    UserRepository,
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    MongooseModule.forFeature([{ name: Products.name, schema: ProductSchema }]),
    MongooseModule.forFeature([{ name: Users.name, schema: UsersSchema }]),
    MongooseModule.forFeature([{name: License.name, schema: LicenseSchema}]),
    StripeModule.forRoot({
      apiKey: config.get('stripe.secret_key'),
      apiVersion: '2023-10-16',
    }),
  ],
})
export class ProductsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        {
          path: `${config.get('appPrefix')}/products`,
          method: RequestMethod.GET,
        },
        {
          path: `${config.get('appPrefix')}/products/:id`,
          method: RequestMethod.GET,
        },
        
      )
      .forRoutes(ProductsController);
  }
}
