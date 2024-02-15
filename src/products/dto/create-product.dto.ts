import {
  IsArray,
  IsEmpty,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  SkuDetails,
  baseType,
  categoryType,
  platformType,
} from 'src/shared/schema/products';

export class CreateProductDto {
  @IsString()
  @IsEmpty()
  productName: string;

  @IsString()
  @IsEmpty()
  description: string;

  @IsOptional()
  image?: string;

  @IsOptional()
  imageDetails: Record<string, any>;

  @IsString()
  @IsEmpty()
  @IsEnum(categoryType)
  category: string;

  @IsString()
  @IsEmpty()
  @IsEnum(platformType)
  platformType: string;

  @IsString()
  @IsEmpty()
  @IsEnum(baseType)
  baseType: string;

  @IsString()
  @IsEmpty()
  productUrl: string;

  @IsString()
  @IsEmpty()
  downloadUrl: string;

  @IsArray()
  @IsEmpty()
  requirementSpecification: Record<string, any>[];

  @IsArray()
  @IsEmpty()
  highlights: string[];

  @IsOptional()
  @IsArray()
  skuDetails: SkuDetails[];

  @IsOptional()
  stripeProductId?: string;
}
