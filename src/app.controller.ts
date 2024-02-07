import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { Request } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/test')
  getTest(): string{
    return this.appService.getTest()
  }

  @Get('/csrf-token')
  getCsrfToken(@Req() req: Request):any{
    return {
      result: req.csrfToken()
    }
  }
}
