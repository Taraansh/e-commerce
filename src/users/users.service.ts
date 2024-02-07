import { UsersSchema } from './../shared/schema/users';
import { Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { userTypes } from 'src/shared/schema/users';
import { UserRepository } from 'src/shared/repositories/user.repository';
import {
  comparePassword,
  generateHashPassword,
} from 'src/shared/utility/password-manager';
import { sendEmail } from 'src/shared/utility/mail-handler';
import config from 'config';
import { generateAuthToken } from 'src/shared/utility/token-generator';

@Injectable()
export class UsersService {
  constructor(
    @Inject(UserRepository) private readonly userDB: UserRepository,
  ) {}
  async create(createUserDto: CreateUserDto) {
    try {
      // generate the hash password
      createUserDto.password = await generateHashPassword(
        createUserDto.password,
      );

      //check if user is admin
      if (
        createUserDto.type === userTypes.ADMIN &&
        createUserDto.secretToken !== config.get('adminSecretToken')
      ) {
        throw new Error('Not allowed to create Admin');
      } else if (createUserDto.type !== userTypes.CUSTOMER) {
        createUserDto.isVerified = true;
      }

      //user already exists
      const user = await this.userDB.findOne({
        email: createUserDto.email,
      });
      if (user) {
        throw new Error('User Already Exists');
      }

      //generate the otp
      const otp = Math.floor(Math.random() * 900000) + 100000;
      const otpExpiryTime = new Date();
      otpExpiryTime.setMinutes(otpExpiryTime.getMinutes() * 10);

      //create new user
      const newUser = await this.userDB.create({
        ...createUserDto,
        otp,
        otpExpiryTime,
      });

      if (newUser.type !== userTypes.ADMIN) {
        sendEmail(
          newUser.email,
          config.get('emailService.emailTemplates.verifyEmail'),
          'Email Verification - E-commerce',
          { customerName: newUser.name, customerEmail: newUser.email, otp },
        );
      }

      return {
        success: true,
        message:
          newUser.type === userTypes.ADMIN
            ? 'Admin created'
            : 'Please activate your account by verifying your email. We have sent you an email with otp',
        result: { email: newUser.email },
      };
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string) {
    try {
      const userExists = await this.userDB.findOne({ email });
      if (!userExists) {
        throw new Error('Invalid Email or Password');
      }
      if (!userExists.isVerified) {
        throw new Error('Please verify your email');
      }
      const isPasswordMatch = await comparePassword(
        password,
        userExists.password,
      );
      if (!isPasswordMatch) {
        throw new Error('Invalid Email or Password');
      }

      const token = await generateAuthToken(userExists._id);

      return {
        success: true,
        message: 'Login Successful',
        result: {
          user: {
            name: userExists.name,
            email: userExists.email,
            type: userExists.type,
            id: userExists._id.toString(),
          },
          token,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async verifyEmail(otp: string, email: string) {
    try {
      const user = await this.userDB.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }
      if (user.otp !== otp) {
        throw new Error('Invalid otp');
      }
      if (user.otpExpiryTime < new Date()) {
        throw new Error('OTP expired');
      }
      await this.userDB.updateOne({ email }, { isVerified: true });

      return {
        success: true,
        message: 'Email Verified successfully. You can login now.',
      };
    } catch (error) {
      throw error;
    }
  }

  async sendOtpEmail(email: string) {
    try {
      const user = await this.userDB.findOne({ email });
      if (!email) {
        throw new Error('User not verified');
      }
      if (user.isVerified) {
        throw new Error('User Already verified');
      }

      //generate the otp
      const otp = Math.floor(Math.random() * 900000) + 100000;
      const otpExpiryTime = new Date();
      otpExpiryTime.setMinutes(otpExpiryTime.getMinutes() * 10);

      await this.userDB.updateOne({ email }, { otp, otpExpiryTime });
      sendEmail(
        user.email,
        config.get('emailService.emailTemplates.verifyEmail'),
        'Email Verification - E-commerce',
        { customerName: user.name, customerEmail: user.email, otp },
      );

      return {
        success: true,
        message: 'Otp sent successfully',
        result: { email: user.email },
      };
    } catch (error) {
      throw error;
    }
  }

  async forgotPassword(email: string) {
    try {
      const user = await this.userDB.findOne({ email });
      if (!user) {
        throw new Error('User does not exist');
      }

      let password = Math.random().toString(36).substring(2, 12);
      const tempPassword = password;
      password = await generateHashPassword(password);
      await this.userDB.updateOne({ _id: user._id }, { password });

      sendEmail(
        user.email,
        config.get('emailService.emailTemplates.forgotPassword'),
        'Reset Password - E-commerce',
        {
          customerName: user.name,
          customerEmail: user.email,
          newPassword: password,
          loginLink: config.get('loginLink'),
        },
      );
      return {
        success: true,
        message: 'Password sent to your email',
        result: { email: user.email, password: tempPassword },
      };
    } catch (error) {
      throw error;
    }
  }

  async findAll(type: string) {
    try {
      const users = await this.userDB.find({type})
      return {
        success: true,
        message: "All users",
        result: users
      }
    } catch (error) {
      throw error;
    }
  }

  async updatePasswordorName(id: string, updateUserDto: UpdateUserDto) {
    try {
      const { oldPassword, newPassword, name } = updateUserDto;
      if (!name && !newPassword) {
        throw new Error('Please provide name or password');
      }
      const user = await this.userDB.findOne({ _id: id });
      if (!user) {
        throw new Error('User not found');
      }
      if (newPassword) {
        const isPasswordMatch = await comparePassword(
          oldPassword,
          user.password,
        );
        if (!isPasswordMatch) {
          throw new Error('Invalid current password');
        }
        const password = await generateHashPassword(newPassword);
        await this.userDB.updateOne({ _id: id }, { password });
      }
      if (name) {
        await this.userDB.updateOne({ _id: id }, { name });
      }

      return {
        success: true,
        message: 'User Updated successfully',
        result: {
          name: user.name,
          email: user.email,
          type: user.type,
          id: user._id.toString(),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
