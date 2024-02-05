import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator"


export class ProductSkuDto {
    @IsString()
    @IsNotEmpty()
    skuName: string

    @IsNumber()
    @IsNotEmpty()
    price: number

    @IsNumber()
    @IsNotEmpty()
    validity: number

    @IsBoolean()
    @IsNotEmpty()
    lifetime: boolean

    @IsOptional()
    stripePriceId?: string
    
    @IsOptional()
    skuCode?: string
}

export class ProductSkuDtoArr {
    @IsNotEmpty()
    @IsArray()
    @ValidateNested({each: true})
    @ArrayMinSize(1)
    skuDetails: ProductSkuDto[]
}