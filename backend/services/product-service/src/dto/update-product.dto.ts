import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

// All fields become optional; validations on present fields still run
export class UpdateProductDto extends PartialType(CreateProductDto) {}
