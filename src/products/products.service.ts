import { Inject, Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsRepository } from 'src/shared/repositories/product.repository';
import { InjectStripe } from 'nestjs-stripe';
import Stripe from 'stripe';
import { Products, SkuDetails } from 'src/shared/schema/products';
import { GetProductQueryDto } from './dto/get-product-query-dto';
import qs2m from 'qs-to-mongo';
import cloudinary from 'cloudinary';
import config from 'config';
import { unlinkSync } from 'fs';
import { ProductSkuDto, ProductSkuDtoArr } from './dto/product-sku.dto';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(ProductsRepository) private readonly productDB: ProductsRepository,
    @InjectStripe() private readonly stripeClient: Stripe,
  ) {
    cloudinary.v2.config({
      cloud_name: config.get('cloudinary.cloud_name'),
      api_key: config.get('cloudinary.api_key'),
      api_secret: config.get('cloudinary.api_secret'),
    });
  }
  async createProduct(createProductDto: CreateProductDto): Promise<{
    message: string;
    result: Products;
    success: boolean;
  }> {
    try {
      // create a product in stripe
      if (!createProductDto.stripeProductId) {
        const createdProductInStripe = await this.stripeClient.products.create({
          name: createProductDto.productName,
          description: createProductDto.description,
        });
        createProductDto.stripeProductId = createdProductInStripe.id;
      }

      // create a product in db
      const createdProductInDB = await this.productDB.create(createProductDto);
      return {
        success: true,
        message: 'Product Created Successfully',
        result: createdProductInDB,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAllProducts(query: GetProductQueryDto) {
    try {
      let callForHomePage = false;
      if (query.homepage) {
        callForHomePage = true;
      }
      delete query.homepage;

      const { criteria, options, links } = qs2m(query);
      if (callForHomePage) {
        const products = await this.productDB.findProductWithGroupBy();
        return {
          success: true,
          message:
            products.length > 0
              ? 'Products Fetched Successfully'
              : 'No Products found',
          result: products,
        };
      }
      const { totalProductCount, products } = await this.productDB.find(
        criteria,
        options,
      );
      return {
        success: true,
        message:
          products.length > 0
            ? 'Products Fetched Successfully'
            : 'No Products found',
        result: {
          metadata: {
            skip: options.skip || 0,
            limit: options.limit || 10,
            total: totalProductCount,
            pages: options.limit
              ? Math.ceil(totalProductCount / options.limit)
              : 1,
            links: links('/', totalProductCount),
          },
          products,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async findOneProduct(id: string): Promise<{
    message: string;
    result: { product: Products; relatedProducts: Products[] };
    success: boolean;
  }> {
    try {
      const product = await this.productDB.findOne({ _id: id });
      if (!product) {
        throw new Error('Product does not exits');
      }
      const relatedProducts: Products[] =
        await this.productDB.findRelatedProducts({
          category: product.category,
          _id: { $ne: id },
        });
      return {
        success: true,
        message: 'Product fetched successfully',
        result: { product, relatedProducts },
      };
    } catch (error) {
      throw error;
    }
  }

  async updateProduct(
    id: string,
    updateProductDto: CreateProductDto,
  ): Promise<{
    message: string;
    result: Products;
    success: boolean;
  }> {
    try {
      const productExist = await this.productDB.findOne({ _id: id });
      if (!productExist) {
        throw new Error('Product does not exist');
      }
      const updatedProduct = await this.productDB.findOneAndUpdate(
        { _id: id },
        updateProductDto,
      );
      if (!updateProductDto.stripeProductId) {
        await this.stripeClient.products.update(productExist.stripeProductId, {
          name: updateProductDto.productName,
          description: updateProductDto.description,
        });
      }
      return {
        success: true,
        message: 'Product Updated Successfully',
        result: updatedProduct,
      };
    } catch (error) {
      throw error;
    }
  }

  async removeProduct(id: string): Promise<{
    message: string;
    success: boolean;
    result: null;
  }> {
    try {
      const productExist = await this.productDB.findOne({ _id: id });
      if (!productExist) {
        throw new Error('Product does not exist');
      }
      await this.productDB.findOneAndDelete({ _id: id });
      await this.stripeClient.products.del(productExist.stripeProductId);
      return {
        message: 'Product deleted successfully',
        success: true,
        result: null,
      };
    } catch (error) {
      throw error;
    }
  }

  async uploadProductImage(
    id: string,
    file: any,
  ): Promise<{
    success: boolean;
    message: string;
    result: string;
  }> {
    try {
      const product = await this.productDB.findOne({ _id: id });
      if (!product) {
        throw new Error('Product does not exist');
      }

      if (product.imageDetails?.public_id) {
        await cloudinary.v2.uploader.destroy(product.imageDetails.public_id, {
          invalidate: true,
        });
      }
      const resOfCloudinary = await cloudinary.v2.uploader.upload(file.path, {
        folder: config.get('cloudinary.folderPath'),
        public_id: `${config.get('cloudinary.publicId_prefix')}${Date.now()}`,
        transformation: [
          {
            width: config.get('cloudinary.bigSize').toString().split('X')[0],
            height: config.get('cloudinary.bigSize').toString().split('X')[1],
            crop: 'fill',
          },
          { quality: 'auto' },
        ],
      });
      unlinkSync(file.path);
      await this.productDB.findOneAndUpdate(
        { _id: id },
        { imageDetails: resOfCloudinary, image: resOfCloudinary.secure_url },
      );

      await this.stripeClient.products.update(product.stripeProductId, {
        images: [resOfCloudinary.secure_url],
      });

      return {
        success: true,
        message: 'Image Uploaded Successfully',
        result: resOfCloudinary.secure_url,
      };
    } catch (error) {
      throw error;
    }
  }

  // this is for create one or multiple sku for an product
  async updateProductSku(productId: string, data: ProductSkuDtoArr) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }

      const skuCode = Math.random().toString(36).substring(2, 5) + Date.now();
      for (let i = 0; i < data.skuDetails.length; i++) {
        if (!data.skuDetails[i].stripePriceId) {
          const stripPriceDetails = await this.stripeClient.prices.create({
            unit_amount: data.skuDetails[i].price * 100,
            currency: 'inr',
            product: product.stripeProductId,
            metadata: {
              skuCode: skuCode,
              lifetime: data.skuDetails[i].lifetime + '',
              productId: productId,
              price: data.skuDetails[i].price,
              productName: product.productName,
              productImage: product.image,
            },
          });
          data.skuDetails[i].stripePriceId = stripPriceDetails.id;
        }
        data.skuDetails[i].skuCode = skuCode;
      }

      await this.productDB.findOneAndUpdate(
        { _id: productId },
        { $push: { skuDetails: data.skuDetails } },
      );

      return {
        message: 'Product sku updated successfully',
        success: true,
        result: null,
      };
    } catch (error) {
      throw error;
    }
  }

  async updateProductSkuById(
    productId: string,
    skuId: string,
    data: ProductSkuDto,
  ) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }
      const sku = product.skuDetails.find((sku) => sku._id == skuId);
      if (!sku) {
        throw new Error('Sku Does not exist');
      }
      if (data.price !== sku.price) {
        const priceDetails = await this.stripeClient.prices.create({
          unit_amount: data.price * 100,
          currency: 'inr',
          product: product.stripeProductId,
          metadata: {
            skuCode: sku.skuCode,
            lifetime: data.lifetime + '',
            productId: productId,
            price: data.price,
            productName: product.productName,
            productImage: product.image,
          },
        });
        data.stripePriceId = priceDetails.id;
      }

      const dataForUpdate = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          dataForUpdate[`skuDetails.$.${key}`] = data[key];
        }
      }

      await this.productDB.findOneAndUpdate(
        { _id: productId, 'skuDetails._id': skuId },
        { $set: dataForUpdate },
      );
      return {
        success: true,
        message: 'Product sku updated successfully',
        result: null,
      };
    } catch (error) {
      throw error;
    }
  }

  async addProductSkuLicense(
    productId: string,
    skuId: string,
    licenseKey: string,
  ) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }
      const sku = product.skuDetails.find((sku) => sku._id == skuId);
      if (!sku) {
        throw new Error('Sku Does not exist');
      }

      const result = await this.productDB.createLicense(
        productId,
        skuId,
        licenseKey,
      );
      return {
        success: true,
        message: 'License key added successfully',
        result: result,
      };
    } catch (error) {
      throw error;
    }
  }

  async removeProductSkuLicense(id: string) {
    try {
      const result = await this.productDB.removeLicense({ _id: id });

      return {
        success: true,
        message: 'License Key removed successfully',
        result: result,
      };
    } catch (error) {
      throw error;
    }
  }

  async getProductSkuLicenses(productId: string, skuId: string) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }
      const sku = product.skuDetails.find((sku) => sku._id == skuId);
      if (!sku) {
        throw new Error('Sku Does not exist');
      }

      const result = await this.productDB.findLicense({
        product: productId,
        productSku: skuId,
      });

      return {
        success: true,
        message: 'Licenses Fetched Successfully',
        result: result,
      };
    } catch (error) {
      throw error;
    }
  }
  async updateProductSkuLicense(
    productId: string,
    skuId: string,
    licenseKeyId: string,
    licenseKey: string,
  ) {
    try {
      const product = await this.productDB.findOne({ _id: productId });
      if (!product) {
        throw new Error('Product does not exist');
      }
      const sku = product.skuDetails.find((sku) => sku._id == skuId);
      if (!sku) {
        throw new Error('Sku Does not exist');
      }

      const result = await this.productDB.updateLicense(
        { _id: licenseKeyId },
        { licenseKey: licenseKey },
      );

      return {
        success: true,
        message: 'License Key Updated',
        result: result,
      };
    } catch (error) {
      throw error;
    }
  }
}