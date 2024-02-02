import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Response } from 'express';
import { Roles } from 'src/shared/middleware/role.decorators';
import { userTypes } from 'src/shared/schema/users';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginUser: { email: string; password: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const loginRes = await this.usersService.login(
      loginUser.email,
      loginUser.password,
    );
    if (loginRes.success) {
      response.cookie('auth_token', loginRes.result?.token, { httpOnly: true });
    }
    delete loginRes.result?.token;
    return loginRes;
  }

  @Get('/verify-email/:otp/:email')
  async verifyEmail(@Param('otp') otp: string, @Param('email') email: string) {
    return await this.usersService.verifyEmail(otp, email);
  }

  @Get('send-otp-email/:email')
  async sendOtpEmail(@Param('email') email: string) {
    return await this.usersService.sendOtpEmail(email);
  }

  @Get('/logout')
  async logout(@Res() res: Response) {
    res.clearCookie('auth_token');
    return res
      .status(HttpStatus.OK)
      .json({ success: true, message: 'User Logged out' });
  }

  @Get('forgot-password/:email')
  async forgotPassword(@Param('email') email: string){
    return await this.usersService.forgotPassword(email)
  }

  @Get()
  @Roles(userTypes.ADMIN)
  async findAll(@Query('type') type:string) {
    return await this.usersService.findAll(type);
  }

  @Patch('/update-name-password')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return await this.usersService.updatePasswordorName(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
