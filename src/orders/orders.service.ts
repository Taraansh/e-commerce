import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { checkoutDtoArr } from './dto/checkout.dto';
import { InjectStripe } from 'nestjs-stripe';
import { OrdersRepository } from 'src/shared/repositories/order.repository';
import { ProductsRepository } from 'src/shared/repositories/product.repository';
import { UserRepository } from 'src/shared/repositories/user.repository';
import Stripe from 'stripe';
import config from 'config';
import { userTypes } from 'src/shared/schema/users';
import { orderStatus, paymentStatus } from 'src/shared/schema/orders';
import { sendEmail } from 'src/shared/utility/mail-handler';

@Injectable()
export class OrdersService {
  constructor(
    @InjectStripe() private readonly stripeClient: Stripe,
    @Inject(OrdersRepository) private readonly orderDB: OrdersRepository,
    @Inject(ProductsRepository) private readonly productDB: ProductsRepository,
    @Inject(UserRepository) private readonly userDB: UserRepository,
  ) {}

  async create(createOrderDto: Record<string, any>) {
    try {
      // console.log(createOrderDto);
      const orderExists = await this.orderDB.findOne({
        checkoutSessionId: createOrderDto.checkoutSessionId,
      });
      if (orderExists) {
        return orderExists;
      }
      const result = await this.orderDB.create(createOrderDto);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async findAll(status: string, user: Record<string, any>) {
    try {
      const userDetails = await this.userDB.findOne({
        _id: user._id.toString(),
      });
      const query = {} as Record<string, any>;
      if (userDetails.type === userTypes.CUSTOMER) {
        query.userId = user._id.toString();
      }
      if (status) {
        query.status = status;
      }
      const orders = await this.orderDB.find(query);
      return {
        success: true,
        result: orders,
        message: 'Orders Fetched Successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const result = await this.orderDB.findOne({ _id: id });
      return {
        success: true,
        result,
        message: 'Order Fetched Successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async checkout(body: checkoutDtoArr, user: Record<string, any>) {
    try {
      const lineItems = [];
      const cartItems = body.checkoutDetails;
      for (const item of cartItems) {
        const itemsAreInStock = await this.productDB.findLicense({
          productSku: item.skuId,
          isSold: false,
        });
        if (itemsAreInStock.length <= item.quantity) {
          lineItems.push({
            price: item.skuPriceId,
            quantity: item.quantity,
            adjustable_quantity: {
              enabled: true,
              maximum: 5,
              minimum: 1,
            },
          });
        }
      }
      if (lineItems.length === 0) {
        throw new BadRequestException(
          'These Products are not available right now',
        );
      }

      const session = await this.stripeClient.checkout.sessions.create({
        line_items: lineItems,
        metadata: {
          userId: user._id.toString(),
        },
        mode: 'payment',
        billing_address_collection: 'required',
        phone_number_collection: { enabled: true },
        customer_email: user.email,
        cancel_url: config.get('stripe.cancelUrl'),
        success_url: config.get('stripe.successUrl'),
      });
      return {
        success: true,
        result: session.url,
        message: 'Payment checkout session successfully created',
      };
    } catch (error) {
      throw error;
    }
  }

  // to create a checkout session, we need to create a webhook, and webhook can only be created on the public url
  async webhook(rawBody: Buffer, sig: string) {
    try {
      let event: Stripe.Event;
      try {
        event = this.stripeClient.webhooks.constructEvent(
          rawBody,
          sig,
          config.get('stripe.webhookSecret'),
        );
        // console.log('event---', event);
        // console.log(event.type);
        // console.log(event.data);
      } catch (err) {
        throw new BadRequestException('Webhook Error:', err.message);
      }
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderData = await this.createOrderObject(session);
        const order = await this.create(orderData);
        if (session.payment_status === paymentStatus.paid) {
          if (order.orderStatus !== orderStatus.completed) {
            for (const item of order.orderedItems) {
              const licenses = await this.getLicense(orderData.orderId, item);
              item.licenses = licenses;
            }
          }
          await this.fullfillOrder(session.id, {
            orderStatus: orderStatus.completed,
            isOrderDelivered: true,
            ...orderData,
          });
          this.sendOrderEmail(
            orderData.customerEmail,
            orderData.orderId,
            `${config.get('emailService.emailTemplates.orderSuccess')}${order._id}`,
          );
        }
      } else {
        console.log('Unhandled event type', event.type);
      }
    } catch (error) {
      throw error;
    }
  }

  async fullfillOrder(
    checkoutSessionId: string,
    updateOrderDto: Record<string, any>,
  ) {
    try {
      return await this.orderDB.findOneAndUpdate(
        { checkoutSessionId },
        updateOrderDto,
        { new: true },
      );
    } catch (error) {
      throw error;
    }
  }

  async sendOrderEmail(email: string, orderId: string, orderLink: string) {
    await sendEmail(
      email,
      config.get('emailService.emailTemplates.orderSuccess'),
      'Order Success - Your Orders',
      {
        orderId,
        orderLink,
      },
    );
  }

  async getLicense(orderId: string, item: Record<string, any>) {
    try {
      const product = await this.productDB.findOne({
        _id: item.productId,
      });
      const skuDetails = product.skuDetails.find(
        (sku) => sku.skuCode === item.skuCode,
      );

      const licenses = await this.productDB.findLicense(
        {
          productSku: skuDetails._id,
          isSold: false,
        },
        item.quantity,
      );

      const licenseIds = licenses.map((license) => license._id);
      await this.productDB.updateLicenseMany(
        {
          _id: {
            $in: licenseIds,
          },
        },
        {
          isSold: true,
          orderId,
        },
      );

      return licenses.map((license) => license.licenseKey);
    } catch (error) {
      throw error;
    }
  }

  async createOrderObject(session: Stripe.Checkout.Session) {
    try {
      // console.log(session);
      const lineItems = await this.stripeClient.checkout.sessions.listLineItems(
        session.id,
      );
      const orderData = {
        orderId: Math.floor(new Date().valueOf() * Math.random()) + '',
        userId: session.metadata?.userId?.toString(),
        userName: session.customer_details?.name,
        customerAddress: session.customer_details?.address,
        customerEmail: session.customer_email,
        customerPhoneNumber: session.customer_details?.phone,
        paymentInfo: {
          paymentMethod: session.payment_method_types[0],
          paymentIntentId: session.payment_intent,
          paymentDate: new Date(),
          paymentAmount: session.amount_total / 100,
          paymentStatus: session.payment_status,
        },
        orderDate: new Date(),
        checkoutSessionId: session.id,
        orderedItems: lineItems.data.map((item) => {
          item.price.metadata.quantity = item.quantity + '';
          return item.price.metadata;
        }),
      };
      return orderData;
    } catch (error) {
      throw error;
    }
  }
}
